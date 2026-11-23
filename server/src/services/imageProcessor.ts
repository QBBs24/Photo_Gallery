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

export interface ImageSegmentMeta {
  index: number;
  key: string;
  top: number;
  height: number;
  width: number;
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
    segmentation?: {
      isSegmented: boolean;
      segmentCount: number;
      segments: ImageSegmentMeta[];
    };
  };
}

/**
 * Stage 1: Validate file binaries, pre-decode pixel limits, and verify integrity.
 * If any check fails, throws an error with a natural language message.
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

  // 2. Pixel Limit Check: Check height * width first before decoding entirely
  let metadata: sharp.Metadata;
  try {
    const pipeline = sharp(file.buffer, {
      limitInputPixels: MAX_PIXELS,
      failOn: 'error',
    });

    metadata = await pipeline.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error(
        `Unable to read image dimensions for '${file.originalname}'. The file might be corrupted.`
      );
    }

    const totalPixels = metadata.width * metadata.height;
    if (totalPixels > MAX_PIXELS) {
      // Exact required message
      throw new Error(
        `Image exceeds the maximum number of pixels allowed. Please resize your image and try again.`
      );
    }
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes('maximum number of pixels') ||
        err.message.toLowerCase().includes('pixel limit') ||
        err.message.toLowerCase().includes('input image exceeds pixel limit'))
    ) {
      throw new Error(
        `Image exceeds the maximum number of pixels allowed. Please resize your image and try again.`
      );
    }
    throw new Error(
      `The uploaded file '${file.originalname}' appears to be corrupted or broken and could not be decoded. Please provide a valid, intact image.`
    );
  }

  // 3. Decoding Check: Deny broken images even if initial signature/metadata is present
  try {
    // Strictly verify full stream decode with failOn: 'error'
    await sharp(file.buffer, {
      limitInputPixels: MAX_PIXELS,
      failOn: 'error',
    })
      .rotate()
      .stats();
  } catch (decodeErr: any) {
    if (decodeErr.message && decodeErr.message.includes('maximum number of pixels')) {
      throw decodeErr;
    }
    throw new Error(
      `The uploaded file '${file.originalname}' appears to be corrupted or broken and could not be decoded. Please provide a valid, intact image.`
    );
  }

  const storageKey = nanoid(21);

  return {
    originalFile: file,
    detectedMime: typeResult.mime,
    width: metadata.width,
    height: metadata.height,
    pixels: metadata.width * metadata.height,
    storageKey,
  };
}

/**
 * Stage 2: Convert to WebP, rotate according to EXIF, strip EXIF metadata,
 * create standard variants, and for large images slice into 10 row segments.
 */
export async function processAndUploadImage(
  validated: ValidatedFile,
  index: number,
  title?: string
): Promise<ProcessedVariantResult> {
  const { originalFile, storageKey } = validated;

  // Re-orient buffer based on EXIF to get normalized orientation & strip EXIF metadata
  const orientedBuffer = await sharp(originalFile.buffer, { limitInputPixels: MAX_PIXELS })
    .rotate() // Auto-orient based on EXIF tags
    .toBuffer();

  const orientedMeta = await sharp(orientedBuffer).metadata();
  const width = orientedMeta.width || validated.width;
  const height = orientedMeta.height || validated.height;

  // 1. Generate WebP Original (highest fidelity, stripped of EXIF)
  const originalWebpBuffer = await sharp(orientedBuffer)
    .webp({ quality: 90 })
    .toBuffer();

  // 2. Generate Medium Variant (max width 1280px, stripped of EXIF)
  const mediumWebpBuffer = await sharp(orientedBuffer)
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  // 3. Generate Thumbnail Variant (fixed width 400px for grid, stripped of EXIF)
  const thumbWebpBuffer = await sharp(orientedBuffer)
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // Object keys in SeaweedFS
  const originalKey = `${storageKey}/original.webp`;
  const mediumKey = `${storageKey}/medium.webp`;
  const thumbKey = `${storageKey}/thumb.webp`;

  const uploadPromises: Promise<any>[] = [
    uploadToStorage(originalKey, originalWebpBuffer, 'image/webp'),
    uploadToStorage(mediumKey, mediumWebpBuffer, 'image/webp'),
    uploadToStorage(thumbKey, thumbWebpBuffer, 'image/webp'),
  ];

  // 4. Large Image Segmentation: Divide into 10 horizontal row segments
  const isLarge = width >= 1500 || height >= 1500 || width * height >= 2_000_000;
  let segmentationData: {
    isSegmented: boolean;
    segmentCount: number;
    segments: ImageSegmentMeta[];
  } | undefined = undefined;

  if (isLarge) {
    const segmentCount = 10;
    const sliceHeight = Math.floor(height / segmentCount);
    const segmentsMeta: ImageSegmentMeta[] = [];

    for (let i = 0; i < segmentCount; i++) {
      const top = i * sliceHeight;
      const currentSliceHeight = i === segmentCount - 1 ? height - top : sliceHeight;
      const segKey = `${storageKey}/segment_${i}.webp`;

      const segPromise = sharp(orientedBuffer)
        .extract({ left: 0, top, width, height: currentSliceHeight })
        .webp({ quality: 85 })
        .toBuffer()
        .then(async (segBuf) => {
          await uploadToStorage(segKey, segBuf, 'image/webp');
        });

      uploadPromises.push(segPromise);

      segmentsMeta.push({
        index: i,
        key: segKey,
        top,
        height: currentSliceHeight,
        width,
      });
    }

    segmentationData = {
      isSegmented: true,
      segmentCount,
      segments: segmentsMeta,
    };
  }

  // Await all uploads to SeaweedFS concurrently
  await Promise.all(uploadPromises);

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
      segmentation: segmentationData,
    },
  };
}
