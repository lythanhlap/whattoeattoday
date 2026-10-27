import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { recipeRoutes } from './routes/recipeRoutes.js';
import { taxonomyRoutes } from './routes/taxonomyRoutes.js';
import { communityRoutes } from './routes/communityRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { mediaRoutes } from './routes/mediaRoutes.js';
import { notificationRoutes } from './routes/notificationRoutes.js';
import { challengeRoutes } from './routes/challengeRoutes.js';
import { discoveryRoutes } from './routes/discoveryRoutes.js';
import { robotsController, sitemapController, sitemapPageController } from './controllers/seoController.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.get('/sitemap.xml', sitemapController);
  app.get('/sitemap-:page.xml', sitemapPageController);
  app.get('/robots.txt', robotsController);
  app.use('/api/v1', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/recipes', recipeRoutes);
  app.use('/api/v1', taxonomyRoutes);
  app.use('/api/v1', communityRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/media', mediaRoutes);
  app.use('/api/v1/me/notifications', notificationRoutes);
  app.use('/api/v1/challenges', challengeRoutes);
  app.use('/api/v1', discoveryRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
