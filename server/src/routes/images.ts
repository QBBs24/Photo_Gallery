import { Router, Request, Response } from 'express';
import { getFromStorage } from '../services/storage.js';

const router = Router();

/**
 * GET /api/images/:storageKey/:variant
 * Serves WebP variants directly from SeaweedFS
 * :variant can be 'original', 'medium', 'thumb', or 'segment_0'...'segment_9'
 */
router.get('/:storageKey/:variant', async (req: Request, res: Response) => {
  try {
    const { storageKey, variant } = req.params;

    const isStandardVariant = ['original', 'medium', 'thumb'].includes(variant);
    const isSegmentVariant = /^segment_[0-9]+$/.test(variant);

    if (!isStandardVariant && !isSegmentVariant) {
      return res.status(400).json({
        error: `Invalid image variant requested. Supported variants are 'thumb', 'medium', 'original', or row segments.`,
      });
    }

    const objectKey = `${storageKey}/${variant}.webp`;

    const { stream, contentType, contentLength } = await getFromStorage(objectKey);

    res.setHeader('Content-Type', contentType || 'image/webp');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    // High-performance browser caching (1 year immutable)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${storageKey}-${variant}"`);

    stream.pipe(res);
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({
        error: 'The requested image could not be found in storage.',
      });
    }
    console.error('Image streaming error:', error);
    res.status(500).json({ error: 'Failed to stream the requested image.' });
  }
});

export default router;
