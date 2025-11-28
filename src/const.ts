export default {
  ALLOWED_FORMATS: ['jpeg', 'webp', 'avif', 'png'],
  ALLOWED_WIDTHS: [64, 128, 256, 320, 480, 640, 768, 1024, 1280],
  CACHE_CONTROL: 60 * 60 * 24 * 365, // seconds | minutes | hours | days | years
  DEFAULT_FORMAT: 'jpeg',
  DEFAULT_WIDTH: String(1024),
  RESIZE_FIT: 'inside',

  S3_REGION: 'your-region', // required
  S3_BUCKET: 'your-bucket', // required
} as const
