import { Router } from 'express';
import { cleanupMediaAssetsController, createUploadSignatureController, registerMediaAssetController } from '../controllers/mediaController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';

export const mediaRoutes = Router();
mediaRoutes.post('/signature', requireAuth, rateLimit({ max: 30 }), createUploadSignatureController);
mediaRoutes.post('/assets', requireAuth, rateLimit({ max: 30 }), registerMediaAssetController);
mediaRoutes.post('/admin/cleanup-orphans', requireAuth, requireRoles('ADMIN'), cleanupMediaAssetsController);
