import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { nanoid } from 'nanoid';
import pLimit from 'p-limit';
import { uploadToStorage } from './storage.js';

export const MAX_PIXELS = 40_000_000; // 40 million pixels

// Global concurrency limiter: max 2 simultaneous heavy Sharp pipelines to protect memory
const processLimit = pLimit(2);

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
    thumb: string;
    thumb_2x: string;
    display: string;
    original: string;
    lqip: string;
    lqipDataUri: string;
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
 * create standard variants concurrently via .clone(), and for large images slice into 10 row segments.
 */
export async function processAndUploadImage(
  validated: ValidatedFile,
  index: number,
  title?: string
): Promise<ProcessedVariantResult> {
  return processLimit(async () => {
    const { originalFile, storageKey } = validated;

    // Decode once and auto-orient based on EXIF (strips EXIF & GPS tags on output)
    const basePipeline = sharp(originalFile.buffer, {
      limitInputPixels: MAX_PIXELS,
      failOn: 'error',
    }).rotate();

    const meta = await basePipeline.metadata();
    let width = meta.width || validated.width;
    let height = meta.height || validated.height;
    if (meta.orientation && meta.orientation >= 5 && meta.orientation <= 8) {
      [width, height] = [height, width];
    }

    // 1. thumb (400px wide, lanczos3, quality: 78, smartSubsample: true, effort: 4)
    const thumbPromise = basePipeline
      .clone()
      .resize({
        width: 400,
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 78, smartSubsample: true, effort: 4 })
      .toBuffer();

    // 2. thumb_2x (800px wide for 2x Retina/HiDPI, lanczos3, quality: 78, smartSubsample: true, effort: 4)
    const thumb2xPromise = basePipeline
      .clone()
      .resize({
        width: 800,
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .webp({ quality: 78, smartSubsample: true, effort: 4 })
      .toBuffer();

    // 3. display (1440px max width, quality: 84, smartSubsample: true, effort: 4)
    const displayPromise = basePipeline
      .clone()
      .resize({
        width: 1440,
        withoutEnlargement: true,
      })
      .webp({ quality: 84, smartSubsample: true, effort: 4 })
      .toBuffer();

    // 4. original (native resolution WebP: lossless for PNG/GIF/lossless WebP, high quality lossy for others)
    const isLosslessSource = ['image/png', 'image/gif', 'image/webp'].includes(validated.detectedMime);
    const originalPromise = isLosslessSource
      ? basePipeline.clone().webp({ lossless: true, effort: 4 }).toBuffer()
      : basePipeline.clone().webp({ quality: 92, smartSubsample: true, effort: 4 }).toBuffer();

    // 5. lqip (16px preview image stored directly in SeaweedFS for instant blurred placeholders)
    const lqipPromise = basePipeline
      .clone()
      .resize({
        width: 16,
        withoutEnlargement: true,
      })
      .webp({ quality: 20, effort: 2 })
      .toBuffer();

    // Await all variant buffers generated concurrently from the single decoded pipeline
    const [thumbBuf, thumb2xBuf, displayBuf, originalBuf, lqipBuf] = await Promise.all([
      thumbPromise,
      thumb2xPromise,
      displayPromise,
      originalPromise,
      lqipPromise,
    ]);

    // Object keys in SeaweedFS
    const originalKey = `${storageKey}/original.webp`;
    const displayKey = `${storageKey}/display.webp`;
    const thumbKey = `${storageKey}/thumb.webp`;
    const thumb2xKey = `${storageKey}/thumb_2x.webp`;
    const lqipKey = `${storageKey}/lqip.webp`;

    const uploadPromises: Promise<any>[] = [
      uploadToStorage(originalKey, originalBuf, 'image/webp'),
      uploadToStorage(displayKey, displayBuf, 'image/webp'),
      uploadToStorage(thumbKey, thumbBuf, 'image/webp'),
      uploadToStorage(thumb2xKey, thumb2xBuf, 'image/webp'),
      uploadToStorage(lqipKey, lqipBuf, 'image/webp'),
    ];

    // 6. Large Image Segmentation: Divide into 10 horizontal row segments
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

        const segPromise = basePipeline
          .clone()
          .extract({ left: 0, top, width, height: currentSliceHeight })
          .webp({ quality: 85, effort: 4 })
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
    const lqipDataUri = `data:image/webp;base64,${lqipBuf.toString('base64')}`;

    return {
      index,
      status: 'success',
      originalFileName: originalFile.originalname,
      storageKey,
      title: cleanTitle,
      mimeType: 'image/webp',
      fileSizeBytes: originalBuf.length,
      width,
      height,
      aspectRatio,
      variants: {
        thumb: thumbKey,
        thumb_2x: thumb2xKey,
        display: displayKey,
        original: originalKey,
        lqip: lqipKey,
        lqipDataUri,
        segmentation: segmentationData,
      },
    };
  });
}
