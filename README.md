# Image Cache CloudFront

A Lambda@Edge function for CloudFront that processes and optimizes images on demand from S3, enabling real-time resizing and format conversion.

## Purpose

This code implements an image caching and transformation system running on CloudFront edge locations. It allows you to:

- **Resize images** to predefined widths based on query parameters
- **Convert formats** (JPEG, WebP, AVIF, PNG) on the fly
- **Optimize performance** by caching transformed images
- **Reduce bandwidth** by serving only the necessary size for each device
- **Improve user experience** with faster load times

## How it works

### Execution Flow

1. **Request Interception**: CloudFront executes the Lambda@Edge function when it receives an image request with query parameters (e.g., `?w=320&format=webp`).

2. **Parameter Validation**:
   - Extracts width (`w`) and format (`format`) from query parameters.
   - Validates that the requested format is allowed.
   - Finds the closest allowed width to the requested one.

3. **Redirection (if needed)**:
   - If the requested width does not exactly match an allowed one, it redirects (301) to the URL with the closest allowed width.
   - This ensures that only images with predefined dimensions are cached.

4. **Image Processing**:
   - Fetches the original image from S3 using the request URI.
   - Uses Sharp to resize the image to the target width.
   - Converts the image to the requested format.
   - Returns the transformed image in base64.

5. **Cached Response**:
   - Returns the image with appropriate cache headers.
   - CloudFront caches the response at edge locations.
   - Subsequent identical requests are served from the cache without executing Lambda.

### Resizing Logic

- **Allowed Widths**: Only processes images with specific widths (e.g., 64, 128, 256, 320, 480, 640, 768, 1024, 1280px).
- **Smart Approximation**: If a non-allowed width is requested (e.g., 350px), it redirects to the closest one (320px).
- **Fit Mode**: Uses `inside` to maintain aspect ratio without cropping.

### Error Handling

- **404**: If the image does not exist in S3, returns a 404 error.
- **500**: Any other error (S3, Sharp, etc.) returns a 500 error.
- **301**: Redirection when the requested width is not allowed.

## Configuration

### Environment Variables / Constants

Edit `src/const.ts` to configure:

```typescript
export default {
  // Allowed image formats
  ALLOWED_FORMATS: ['jpeg', 'webp', 'avif', 'png'],
  
  // Allowed widths (in pixels)
  ALLOWED_WIDTHS: [64, 128, 256, 320, 480, 640, 768, 1024, 1280],
  
  // Cache duration in seconds (default: 1 year)
  CACHE_CONTROL: 60 * 60 * 24 * 365,
  
  // Default format if none specified
  DEFAULT_FORMAT: 'jpeg',
  
  // Default width if none specified
  DEFAULT_WIDTH: String(1024),
  
  // Sharp resize mode ('inside', 'cover', 'contain', etc.)
  RESIZE_FIT: 'inside',
  
  // ⚠️ REQUIRED: S3 Region
  S3_REGION: 'your-region',
  
  // ⚠️ REQUIRED: S3 Bucket Name
  S3_BUCKET: 'your-bucket',
}
```

### API Usage

Once deployed, you can request transformed images using query parameters:

```
https://your-distribution.cloudfront.net/imgs/properties/1234567890.png?w=320&format=webp
```

**Available Parameters:**
- `w`: Desired width (must be one of the allowed widths or close to one).
- `format`: Desired format (`jpeg`, `webp`, `avif`, `png`).

**Examples:**
- `/imgs/photo.jpg?w=640` → Image at 640px in JPEG format (default).
- `/imgs/photo.jpg?w=320&format=webp` → Image at 320px in WebP format.
- `/imgs/photo.jpg?w=350` → Redirects to 320px (closest match).

## Lambda@Edge Permissions

⚠️ **IMPORTANT**: For Lambda@Edge to work correctly, you must grant specific permissions to CloudFront to invoke your Lambda function.

### Steps to Configure Permissions:

1. **Create the Lambda function** with the compiled code.

2. **Publish a Version**:
   - In the AWS Lambda console, select your function.
   - Go to "Versions" → "Create version".
   - This creates an immutable version required for Lambda@Edge.

3. **Grant Permissions to CloudFront**:
   - In the Lambda function, go to "Configuration" → "Permissions".
   - Click "Add permissions" → "Create policy".
   - Or use the following AWS CLI command:

```bash
aws lambda add-permission \
  --function-name your-function-name:VERSION \
  --statement-id allow-cloudfront \
  --principal edgelambda.amazonaws.com \
  --action lambda:InvokeFunction
```

4. **Associate with CloudFront**:
   - In CloudFront, edit your distribution.
   - Go to "Behaviors" → Edit the desired behavior.
   - In "Function associations":
     - **Viewer Request**: Select your Lambda@Edge function (specific version).
   - Save changes.

### Important Notes on Lambda@Edge:

- You can only associate Lambda@Edge functions with **specific versions** (not `$LATEST`).
- Changes to the function require creating a new version and updating CloudFront.
- The function must be in the `us-east-1` region to be associated with CloudFront.
- Permissions must be granted to `edgelambda.amazonaws.com`.

## Build and Deploy

### Prerequisites

- Node.js and pnpm installed
- AWS CLI configured
- Access to AWS S3 and CloudFront

### Build the Project

```bash
# Install dependencies
pnpm install

# Build the package for Lambda
npm run build:zip
```

This will generate `image-cache-cloudfront.zip` ready for Lambda deployment.

### Deploy

1. Upload the ZIP to Lambda using the AWS Console or CLI.
2. Create a version of the function.
3. Associate the version with your CloudFront distribution as explained above.

## Project Structure

```
.
├── src/
│   ├── index.ts      # Main Lambda@Edge handler
│   └── const.ts      # Configuration and constants
├── build-script.ts   # Script to prepare production package.json
├── package.json      # Dependencies and scripts
└── README.md         # This file
```

## Dependencies

- **Sharp**: High-performance image processing.
- **pino**: Structured logger.
- **@aws-sdk/client-s3**: AWS SDK v3 client for S3.
  > **Note**: This is listed as a `devDependency` and is **excluded** from the final deployment bundle. The AWS Lambda runtime environment includes the AWS SDK v3, so we rely on the pre-installed version to reduce package size.

## License

MIT
