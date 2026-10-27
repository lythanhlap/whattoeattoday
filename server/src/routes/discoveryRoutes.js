import { Router } from 'express';
import { trendingKeywordsController } from '../controllers/discoveryController.js';

export const discoveryRoutes = Router();
discoveryRoutes.get('/trending-keywords', trendingKeywordsController);
