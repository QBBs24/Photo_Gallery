import { Router, Response } from 'express';
import sharp from 'sharp';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { checkTotalRequestSize, handleMultipartUpload } from '../middleware/upload.js';
import {
  validateImageFile,
  processAndUploadImage,
  ValidatedFile,
  ProcessedVariantResult,
  MAX_PIXELS,
} from '../services/imageProcessor.js';
import { getFromStorage, deleteFromStorage } from '../services/storage.js';

const router = Router();

/**
 * POST /api/photos/upload
 * Requires registered user authentication
 * Multipart form: field 'images' (1-2 files), optional 'titles' (array or string)
 */
router.post(
  '/upload',
  authenticate,
  checkTotalRequestSize,
  handleMultipartUpload,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'You must be registered and logged in to upload images.',
        });
      }

      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          error: 'Please provide at least 1 image to upload (maximum 2 allowed).',
        });
      }

      if (files.length > 2) {
        return res.status(400).json({
          error: 'At most 2 files can be uploaded per request.',
        });
      }

      // Parse optional titles
      let titles: string[] = [];
      if (req.body.titles) {
        if (Array.isArray(req.body.titles)) {
          titles = req.body.titles;
        } else if (typeof req.body.titles === 'string') {
          try {
            const parsed = JSON.parse(req.body.titles);
            titles = Array.isArray(parsed) ? parsed : [req.body.titles];
          } catch {
            titles = [req.body.titles];
          }
        }
      }

      // STAGE 1: Atomic Validation (Binary Magic Number & Pixel Limits)
      // Inspect all files. If ANY fails, deny entire request and DO NOT save any files.
      const validatedFiles: ValidatedFile[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          const validated = await validateImageFile(files[i], i);
          validatedFiles.push(validated);
        } catch (valError: any) {
          // Deny request immediately with natural language message
          return res.status(400).json({
            error: valError.message || 'Validation failed for one of the uploaded images.',
          });
        }
      }

      // STAGE 2: Processing, WebP Variant Creation & Object Storage Upload
      const processedResults: ProcessedVariantResult[] = [];
      for (let i = 0; i < validatedFiles.length; i++) {
        const title = titles[i] || undefined;
        const result = await processAndUploadImage(validatedFiles[i], i, title);
        processedResults.push(result);
      }

      // STAGE 3: Persist Metadata to Supabase via Prisma (NO raw bytes, NO absolute URLs)
      const createdPhotos = await Promise.all(
        processedResults.map(async (item) => {
          return await prisma.photo.create({
            data: {
              storageKey: item.storageKey,
              title: item.title,
              originalFileName: item.originalFileName,
              mimeType: item.mimeType,
              fileSizeBytes: item.fileSizeBytes,
              width: item.width,
              height: item.height,
              aspectRatio: item.aspectRatio,
              variants: item.variants as any,
              userId: req.user!.id,
            },
          });
        })
      );

      // Return itemized evidence response per index
      res.status(201).json({
        success: true,
        message: `Successfully uploaded and processed ${createdPhotos.length} image(s).`,
        evidence: processedResults.map((item, idx) => ({
          index: item.index,
          id: createdPhotos[idx].id,
          status: 'success',
          originalFileName: item.originalFileName,
          storageKey: item.storageKey,
          title: item.title,
          dimensions: {
            width: item.width,
            height: item.height,
            aspectRatio: item.aspectRatio,
          },
          sizeBytes: item.fileSizeBytes,
          format: 'image/webp',
          variants: item.variants,
        })),
      });
    } catch (error: any) {
      console.error('Upload processing error:', error);
      res.status(500).json({
        error: error.message || 'A server error occurred while processing the uploaded files.',
      });
    }
  }
);

/**
 * GET /api/photos
 * Public gallery feed with pagination (page & limit) for infinite scrolling
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 12));
    const skip = (page - 1) * limit;

    const [photos, totalCount] = await Promise.all([
      prisma.photo.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true },
          },
        },
      }),
      prisma.photo.count(),
    ]);

    const hasMore = skip + photos.length < totalCount;

    res.json({
      photos,
      pagination: {
        page,
        limit,
        total: totalCount,
        hasMore,
        nextPage: hasMore ? page + 1 : null,
      },
    });
  } catch (error: any) {
    console.error('Gallery query error:', error);
    res.status(500).json({ error: 'Failed to retrieve photo gallery.' });
  }
});

/**
 * GET /api/photos/:id
 * Image Details view
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const photo = await prisma.photo.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });

    if (!photo) {
      return res.status(404).json({
        error: 'The requested photo could not be found.',
      });
    }

    res.json({ photo });
  } catch (error: any) {
    console.error('Photo lookup error:', error);
    res.status(500).json({ error: 'Failed to retrieve image details.' });
  }
});

/**
 * POST /api/photos/:id/edit
 * Edit photo (Crop & Rotate): ONLY THE UPLOADER OF THE IMAGE CAN EDIT THEIR IMAGE
 */
router.post('/:id/edit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'You must be logged in to edit an image.',
      });
    }

    const { id } = req.params;

    const photo = await prisma.photo.findUnique({
      where: { id },
    });

    if (!photo) {
      return res.status(404).json({
        error: 'The requested photo could not be found.',
      });
    }

    // Verify ownership: ONLY the uploader can edit their image
    if (photo.userId !== req.user.id) {
      return res.status(403).json({
        error: 'You do not have permission to edit this photo. Only the uploader can edit their image.',
      });
    }

    const { rotation, flipHorizontal, crop, title } = req.body;
    const cleanTitle = typeof title === 'string' && title.trim() ? title.trim() : photo.title;

    // 1. Fetch original WebP buffer from SeaweedFS
    const originalObjectKey = (photo.variants as any)?.original || `${photo.storageKey}/original.webp`;
    const { stream } = await getFromStorage(originalObjectKey);

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const originalBuffer = Buffer.concat(chunks);

    // 2. Apply transformations with sharp
    let transform = sharp(originalBuffer, { limitInputPixels: MAX_PIXELS });

    // Flip horizontally if requested
    if (flipHorizontal) {
      transform = transform.flop();
    }

    // Normalize rotation: -270..270 -> 0, 90, 180, 270
    const normalizedRotation = (((Number(rotation) || 0) % 360) + 360) % 360;
    if (normalizedRotation !== 0) {
      transform = transform.rotate(normalizedRotation);
    }

    // Crop if specified
    if (
      crop &&
      typeof crop.widthPercent === 'number' &&
      typeof crop.heightPercent === 'number' &&
      crop.widthPercent > 0 &&
      crop.heightPercent > 0
    ) {
      const intermediate = await transform.toBuffer();
      const meta = await sharp(intermediate).metadata();
      const imgWidth = meta.width || photo.width;
      const imgHeight = meta.height || photo.height;

      const left = Math.max(0, Math.min(imgWidth - 1, Math.round((crop.xPercent / 100) * imgWidth)));
      const top = Math.max(0, Math.min(imgHeight - 1, Math.round((crop.yPercent / 100) * imgHeight)));
      const width = Math.max(1, Math.min(imgWidth - left, Math.round((crop.widthPercent / 100) * imgWidth)));
      const height = Math.max(1, Math.min(imgHeight - top, Math.round((crop.heightPercent / 100) * imgHeight)));

      transform = sharp(intermediate).extract({ left, top, width, height });
    }

    const transformedBuffer = await transform.webp({ quality: 95 }).toBuffer();

    // 3. Validate transformed image
    const fakeMulterFile: Express.Multer.File = {
      buffer: transformedBuffer,
      originalname: photo.originalFileName,
      fieldname: 'image',
      encoding: '7bit',
      mimetype: 'image/webp',
      size: transformedBuffer.length,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    const validated = await validateImageFile(fakeMulterFile, 0);

    // 4. Clean up previous SeaweedFS objects to prevent orphaned storage
    const oldKeysToDelete: string[] = [];
    const oldVariants = photo.variants as any;
    if (oldVariants) {
      if (typeof oldVariants.thumb === 'string') oldKeysToDelete.push(oldVariants.thumb);
      if (typeof oldVariants.thumb_2x === 'string') oldKeysToDelete.push(oldVariants.thumb_2x);
      if (typeof oldVariants.display === 'string') oldKeysToDelete.push(oldVariants.display);
      if (typeof oldVariants.original === 'string') oldKeysToDelete.push(oldVariants.original);
      if (typeof oldVariants.lqip === 'string') oldKeysToDelete.push(oldVariants.lqip);
      if (oldVariants.segmentation?.segments && Array.isArray(oldVariants.segmentation.segments)) {
        for (const seg of oldVariants.segmentation.segments) {
          if (seg.key) oldKeysToDelete.push(seg.key);
        }
      }
    }

    await Promise.allSettled(
      oldKeysToDelete.map(async (key) => {
        try {
          await deleteFromStorage(key);
        } catch (storageErr) {
          console.warn(`[Storage] Failed to delete old object ${key}:`, storageErr);
        }
      })
    );

    // 5. Generate and upload all 5 optimal variants under new storageKey
    const result = await processAndUploadImage(validated, 0, cleanTitle);

    // 6. Update database record with new title, storageKey and dimensions
    const updatedPhoto = await prisma.photo.update({
      where: { id },
      data: {
        title: cleanTitle,
        storageKey: validated.storageKey,
        width: result.width,
        height: result.height,
        aspectRatio: result.aspectRatio,
        fileSizeBytes: result.fileSizeBytes,
        variants: result.variants as any,
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });

    res.json({
      success: true,
      message: 'Photo edited and saved successfully.',
      photo: updatedPhoto,
    });
  } catch (error: any) {
    console.error('Photo edit error:', error);
    res.status(500).json({ error: error.message || 'Failed to edit photo.' });
  }
});

/**
 * DELETE /api/photos/:id
 * Delete photo: ONLY THE UPLOADER OF THE IMAGE CAN DELETE THEIR IMAGE
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'You must be logged in to delete an image.',
      });
    }

    const { id } = req.params;

    const photo = await prisma.photo.findUnique({
      where: { id },
    });

    if (!photo) {
      return res.status(404).json({
        error: 'The requested photo could not be found.',
      });
    }

    // Verify ownership: ONLY the uploader can delete their image
    if (photo.userId !== req.user.id) {
      return res.status(403).json({
        error: 'You do not have permission to delete this photo. Only the uploader can delete their image.',
      });
    }

    // Delete object files from SeaweedFS
    const keysToDelete: string[] = [];
    const variants = photo.variants as any;
    if (variants) {
      if (typeof variants.thumb === 'string') keysToDelete.push(variants.thumb);
      if (typeof variants.thumb_2x === 'string') keysToDelete.push(variants.thumb_2x);
      if (typeof variants.display === 'string') keysToDelete.push(variants.display);
      if (typeof variants.original === 'string') keysToDelete.push(variants.original);
      if (typeof variants.lqip === 'string') keysToDelete.push(variants.lqip);
      if (variants.segmentation?.segments && Array.isArray(variants.segmentation.segments)) {
        for (const seg of variants.segmentation.segments) {
          if (seg.key) keysToDelete.push(seg.key);
        }
      }
    }

    // Attempt storage deletion (log warnings if any single key fails, but proceed)
    await Promise.allSettled(
      keysToDelete.map(async (key) => {
        try {
          await deleteFromStorage(key);
        } catch (storageErr) {
          console.warn(`[Storage] Failed to delete object ${key}:`, storageErr);
        }
      })
    );

    // Delete from database
    await prisma.photo.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Photo deleted successfully.',
    });
  } catch (error: any) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete photo.' });
  }
});

export default router;
