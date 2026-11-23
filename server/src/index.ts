import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from workspace root or current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import authRoutes from './routes/auth.js';
import photoRoutes from './routes/photos.js';
import imageRoutes from './routes/images.js';
import { ensureBucketExists } from './services/storage.js';

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// CORS setup
app.use(
  cors({
    origin: [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

// Standard parsers (excluding multipart which is handled by multer in routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Photo Gallery API',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/images', imageRoutes);

// Fallback error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected error occurred on the server.',
  });
});

app.listen(PORT, async () => {
  console.log(`[Photo Gallery Server] Running on http://localhost:${PORT}`);
  try {
    await ensureBucketExists();
    console.log('[SeaweedFS] Verified S3 bucket connectivity.');
  } catch (err: any) {
    console.warn('[SeaweedFS] Notice: Could not connect to SeaweedFS S3 gateway yet.', err.message);
    console.warn('[SeaweedFS] Please ensure SeaweedFS is running via `npm run storage:start`.');
  }
});
