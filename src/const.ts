export default {
  ALLOWED_WIDTHS: [64, 128, 256, 320, 480, 640, 768, 1024, 1280],
  DEFAULT_WIDTH: String(1024),
  ALLOWED_FORMATS: ['jpeg', 'webp', 'avif', 'png'],
  DEFAULT_FORMAT: 'jpeg',

  S3_REGION: 'sa-east-1', // required
  S3_BUCKET: 'your-bucket', // required
} as const
