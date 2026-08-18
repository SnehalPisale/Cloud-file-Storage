const { S3Client } = require("@aws-sdk/client-s3");

// Centralized S3 client, built from environment variables (see .env.example).
// Uses standard AWS SDK v3 credential resolution: env vars here, but this
// also works with an IAM role if you later deploy to EC2/ECS/Lambda.
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

module.exports = s3Client;
