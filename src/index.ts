import { S3 } from '@aws-sdk/client-s3'
import Sharp from 'sharp'
import pino from 'pino'
import config from '@/const'
import type { CloudFrontRequestEvent } from 'aws-lambda'

const logger = pino()

export const handler = async (event: CloudFrontRequestEvent) => {
  const request = event.Records[0].cf.request
  const { uri, querystring } = request
  // uri example - /imgs/properties/1234567890.png or /imgs/posts/1234567890/img1.jpg
  // queryString example - ?w=320&format=webp

  const {
    ALLOWED_WIDTHS,
    ALLOWED_FORMATS,
    CACHE_CONTROL,
    DEFAULT_WIDTH,
    DEFAULT_FORMAT,
    RESIZE_FIT,
    S3_REGION,
    S3_BUCKET
  } = config

  // Extraer parámetros (ej: ?w=320&format=webp)
  const params = new URLSearchParams(querystring)
  const requestedWidth = parseInt(params.get('w') || DEFAULT_WIDTH) as typeof ALLOWED_WIDTHS[number]
  const requestedFormat = (params.get('format') || DEFAULT_FORMAT) as typeof ALLOWED_FORMATS[number]

  // Validación de formato
  const format = ALLOWED_FORMATS.includes(requestedFormat) ? requestedFormat : DEFAULT_FORMAT

  // Encontrar el ancho permitido más cercano
  const closestWidth = ALLOWED_WIDTHS.reduce((prev, curr) =>
    Math.abs(curr - requestedWidth) < Math.abs(prev - requestedWidth) ? curr : prev
  )

  // Si el ancho solicitado no es exactamente uno permitido, redirigir
  if (!ALLOWED_WIDTHS.includes(requestedWidth)) {
    console.log(`Width not allowed: ${requestedWidth}. Redirecting to ${closestWidth}`)
    const redirectUrl = `${uri}?w=${closestWidth}${format !== DEFAULT_FORMAT ? `&format=${format}` : ''}`

    return {
      status: '301',
      statusDescription: 'Moved Permanently',
      headers: {
        location: [{ value: redirectUrl }],
        'cache-control': [{ value: `max-age=${CACHE_CONTROL}` }]
      }
    }
  }

  // Continuar con el procesamiento normal
  const s3 = new S3({ region: S3_REGION })
  const key = uri.slice(1)

  // Obtener el objeto de S3
  try {
    const originalImage = await s3.getObject({ Bucket: S3_BUCKET, Key: key })
    const imageBody = await originalImage.Body?.transformToByteArray()

    const transformedImage = await Sharp(imageBody)
      .resize({ width: closestWidth, fit: RESIZE_FIT })
      .toFormat(format)
      .toBuffer()

    return {
      status: '200',
      body: transformedImage.toString('base64'),
      bodyEncoding: 'base64',
      headers: {
        'content-type': [{ value: `image/${format}` }],
        'cache-control': [{ value: `max-age=${CACHE_CONTROL}` }],
        vary: [{ value: 'Accept' }]
      }
    }
  } catch (error: unknown) {
    // Check if the error is that the file does not exist in S3
    // In AWS SDK v3, errors have $metadata with httpStatusCode
    const awsError = error as { name?: string; $metadata?: { httpStatusCode?: number } }
    const isNotFoundError =
      awsError.name === 'NoSuchKey' ||
      awsError.name === 'NotFound' ||
      awsError.$metadata?.httpStatusCode === 404

    if (isNotFoundError) {
      return {
        status: '404',
        statusDescription: 'Not Found',
        headers: {
          'content-type': [{ value: 'text/plain' }]
        },
        body: 'Image not found'
      }
    }
    logger.error(error, 'Error processing image')
    // Any other error (S3, Sharp, etc.) is a 500 error
    return {
      status: '500',
      statusDescription: 'Internal Server Error',
      headers: {
        'content-type': [{ value: 'text/plain' }]
      },
      body: 'Internal server error'
    }
  }
}
