import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { checkTotalRequestSize, handleMultipartUpload } from '../middleware/upload.js';
import {
  validateImageFile,
  processAndUploadImage,
  ValidatedFile,
  ProcessedVariantResult,
} from '../services/imageProcessor.js';
import { getFromStorage } from '../services/storage.js';

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
              variants: item.variants,
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

export default router;
