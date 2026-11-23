import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { nanoid } from 'nanoid';
import { uploadToStorage } from './storage.js';

export const MAX_PIXELS = 40_000_000; // 40 million pixels

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/bmp',
  'image/webp',
]);

export interface ValidatedFile {
  originalFile: Express.Multer.File;
  detectedMime: string;
  width: number;
  height: number;
  pixels: number;
  storageKey: string;
}

export interface ProcessedVariantResult {
  index: number;
  status: 'success';
  originalFileName: string;
  storageKey: string;
  title: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  aspectRatio: number;
  variants: {
    original: string;
    medium: string;
    thumb: string;
  };
}

/**
 * Stage 1: Validate file binaries and pixel limits without saving anything
 * If any file fails, throws an error with a natural language message.
 */
export async function validateImageFile(
  file: Express.Multer.File,
  index: number
): Promise<ValidatedFile> {
  // 1. Binary Magic Number verification
  const typeResult = await fileTypeFromBuffer(file.buffer);

  if (!typeResult || !ACCEPTED_MIME_TYPES.has(typeResult.mime)) {
    throw new Error(
      `The uploaded file '${file.originalname}' (file #${index + 1}) was rejected because it is not an authentic image. Accepted image formats are PNG, JPEG, HEIC, HEIF, TIFF, and BMP.`
    );
  }

  // 2. Pixel Limit Verification with Sharp pre-decode gate
  try {
    const pipeline = sharp(file.buffer, {
      limitInputPixels: MAX_PIXELS,
      failOn: 'error',
    });

    const metadata = await pipeline.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error(
        `Unable to read image dimensions for '${file.originalname}'. The file might be corrupted.`
      );
    }

    const totalPixels = metadata.width * metadata.height;
    if (totalPixels > MAX_PIXELS) {
      throw new Error(
        `The image '${file.originalname}' exceeds the maximum allowed resolution of 40 million pixels (detected ${totalPixels.toLocaleString()} pixels). The image was rejected before decoding.`
      );
    }

    const storageKey = nanoid(21);

    return {
      originalFile: file,
      detectedMime: typeResult.mime,
      width: metadata.width,
      height: metadata.height,
      pixels: totalPixels,
      storageKey,
    };
  } catch (err: any) {
    if (err.message && err.message.toLowerCase().includes('pixel limit')) {
      throw new Error(
        `The image '${file.originalname}' exceeds the maximum allowed resolution of 40 million pixels. The image was rejected before decoding.`
      );
    }
    throw err;
  }
}

/**
 * Stage 2: Convert to WebP, generate variants, and upload to SeaweedFS
 */
export async function processAndUploadImage(
  validated: ValidatedFile,
  index: number,
  title?: string
): Promise<ProcessedVariantResult> {
  const { originalFile, width, height, storageKey } = validated;

  // 1. Generate WebP Original (highest fidelity)
  const originalWebpBuffer = await sharp(originalFile.buffer, { limitInputPixels: MAX_PIXELS })
    .rotate() // Auto-orient according to EXIF
    .webp({ quality: 90 })
    .toBuffer();

  // 2. Generate Medium Variant (max width 1280px)
  const mediumWebpBuffer = await sharp(originalFile.buffer, { limitInputPixels: MAX_PIXELS })
    .rotate()
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  // 3. Generate Thumbnail Variant (fixed width 400px for masonry/grid)
  const thumbWebpBuffer = await sharp(originalFile.buffer, { limitInputPixels: MAX_PIXELS })
    .rotate()
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // Object keys in SeaweedFS (relative storage paths, no host URLs)
  const originalKey = `${storageKey}/original.webp`;
  const mediumKey = `${storageKey}/medium.webp`;
  const thumbKey = `${storageKey}/thumb.webp`;

  // Upload variants to SeaweedFS in parallel
  await Promise.all([
    uploadToStorage(originalKey, originalWebpBuffer, 'image/webp'),
    uploadToStorage(mediumKey, mediumWebpBuffer, 'image/webp'),
    uploadToStorage(thumbKey, thumbWebpBuffer, 'image/webp'),
  ]);

  const cleanTitle = title?.trim() || originalFile.originalname.replace(/\.[^/.]+$/, '');
  const aspectRatio = Number((width / height).toFixed(4));

  return {
    index,
    status: 'success',
    originalFileName: originalFile.originalname,
    storageKey,
    title: cleanTitle,
    mimeType: 'image/webp',
    fileSizeBytes: originalWebpBuffer.length,
    width,
    height,
    aspectRatio,
    variants: {
      original: originalKey,
      medium: mediumKey,
      thumb: thumbKey,
    },
  };
}
