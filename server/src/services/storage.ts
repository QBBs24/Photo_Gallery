import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const endpoint = process.env.SEAWEEDFS_S3_ENDPOINT || 'http://127.0.0.1:8333';
const accessKeyId = process.env.SEAWEEDFS_ACCESS_KEY || 'gallery_access_key';
const secretAccessKey = process.env.SEAWEEDFS_SECRET_KEY || 'gallery_secret_key';
export const BUCKET_NAME = process.env.SEAWEEDFS_BUCKET || 'photos';
const region = process.env.SEAWEEDFS_REGION || 'us-east-1';

export const s3Client = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true, // Necessary for SeaweedFS path-based access
});

let bucketChecked = false;

export async function ensureBucketExists(): Promise<void> {
  if (bucketChecked) return;
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    bucketChecked = true;
  } catch (error: any) {
    // If bucket doesn't exist, create it
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      bucketChecked = true;
      console.log(`[SeaweedFS] Created bucket: ${BUCKET_NAME}`);
    } catch (createErr) {
      console.error(`[SeaweedFS] Error creating bucket ${BUCKET_NAME}:`, createErr);
      throw createErr;
    }
  }
}

/**
 * Upload an image variant buffer to SeaweedFS under the given object key
 */
export async function uploadToStorage(
  objectKey: string,
  buffer: Buffer,
  contentType: string = 'image/webp'
): Promise<string> {
  await ensureBucketExists();

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectKey,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return objectKey;
}

/**
 * Fetch an image stream from SeaweedFS
 */
export async function getFromStorage(objectKey: string): Promise<{
  stream: Readable;
  contentType: string;
  contentLength?: number;
}> {
  await ensureBucketExists();

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectKey,
  });

  const response = await s3Client.send(command);
  return {
    stream: response.Body as Readable,
    contentType: response.ContentType || 'image/webp',
    contentLength: response.ContentLength,
  };
}

/**
 * Delete an object from SeaweedFS
 */
export async function deleteFromStorage(objectKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: objectKey,
  });
  await s3Client.send(command);
}
