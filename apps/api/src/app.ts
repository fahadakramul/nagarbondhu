import express from 'express';
import cors from 'cors';
import path from 'path';
import { CONFIG } from './config';
import { persistMutations, persistenceState, readImage } from './persistence';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import reportRoutes from './routes/report.routes';
import aiRoutes from './routes/ai.routes';
import mapRoutes from './routes/map.routes';
import duplicateRoutes from './routes/duplicate.routes';
import dashboardRoutes from './routes/dashboard.routes';
import adminRoutes from './routes/admin.routes';
import actionRoutes from './routes/action.routes';

export const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(persistMutations);

import fs from 'fs';

// Static uploads directory and Public Web App
app.get('/uploads/:filename', async (req, res, next) => {
  try {
    const image = await readImage(req.params.filename);
    if (image) return res.type(image.mimeType).set('Cache-Control', 'public, max-age=86400').send(image.data);
    next();
  } catch (error) { next(error); }
});
app.use('/uploads', express.static(CONFIG.UPLOAD_DIR));
app.use(express.static(CONFIG.PUBLIC_DIR));

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'NagarBondhu AI Backend & Web App',
    targetCity: 'Rajshahi, Bangladesh',
    timestamp: new Date().toISOString(),
    persistence: persistenceState,
  });
});

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/map', mapRoutes);
app.use('/api/v1/duplicates', duplicateRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin', actionRoutes);

// SPA fallback for web app routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  const indexPath = path.join(CONFIG.PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// Centralized Error Handling
app.use(errorHandler);
