import Sharp from 'sharp'
import { S3 } from '@aws-sdk/client-s3'
import config from '@/const'
import type { CloudFrontRequestEvent } from 'aws-lambda'

export const handler = async (event: CloudFrontRequestEvent) => {
  const request = event.Records[0].cf.request
  const { uri, querystring } = request

  const {
    ALLOWED_WIDTHS,
    ALLOWED_FORMATS,
    DEFAULT_WIDTH,
    DEFAULT_FORMAT,
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
        'cache-control': [{ value: 'max-age=31536000' }]
      }
    }
  }

  // Continuar con el procesamiento normal
  const s3 = new S3({ region: S3_REGION })
  const key = uri.slice(1)
  // const [...resourcePath, resourceId] = key.split('/')

  // Obtener el objeto de S3
  try {
    const originalImage = await s3.getObject({ Bucket: S3_BUCKET, Key: key })
    const imageBody = await originalImage.Body?.transformToByteArray()

    const transformedImage = await Sharp(imageBody)
      .resize({ width: closestWidth, fit: 'inside' })
      .toFormat(format)
      .toBuffer()

    return {
      status: '200',
      body: transformedImage.toString('base64'),
      bodyEncoding: 'base64',
      headers: {
        'content-type': [{ value: `image/${format}` }],
        'cache-control': [{ value: 'max-age=31536000' }],
        vary: [{ value: 'Accept' }]
      }
    }
  } catch (error: any) { // TODO: Add type
    // Verificar si el error es que el archivo no existe
    return {
      status: '404',
      statusDescription: 'Not Found',
      headers: {
        'content-type': [{ value: 'text/plain' }]
      },
      body: 'Image not found'
    }
  }
}
