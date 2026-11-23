import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

// Limits
const MAX_TOTAL_REQUEST_SIZE = 55 * 1024 * 1024; // 55 MiB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MiB
const MAX_FILES_COUNT = 2;

// Memory storage to inspect binaries directly
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_COUNT,
  },
});

/**
 * Middleware to check total request size before or during body parsing
 */
export function checkTotalRequestSize(req: Request, res: Response, next: NextFunction): void {
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength, 10) > MAX_TOTAL_REQUEST_SIZE) {
    res.status(413).json({
      error: 'The total request size exceeds the allowed limit of 55 MiB. Please reduce your upload size.',
    });
    return;
  }
  next();
}

/**
 * Middleware handling multipart upload with custom natural language errors
 */
export function handleMultipartUpload(req: Request, res: Response, next: NextFunction): void {
  const uploadArray = upload.array('images', MAX_FILES_COUNT);

  uploadArray(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'One or more files exceed the maximum allowed size of 10 MiB. Upload was cancelled and no files were saved.',
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            error: 'You can upload at most 2 images per request.',
          });
        }
        return res.status(400).json({
          error: `Upload rejected due to transfer error: ${err.message}`,
        });
      }
      return res.status(400).json({
        error: `Upload processing failed: ${err.message}`,
      });
    }

    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      return res.status(400).json({
        error: 'Please select at least 1 image file to upload (maximum 2 allowed).',
      });
    }

    next();
  });
}
