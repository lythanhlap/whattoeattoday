import { Router } from 'express';
import {
  createBannerController,
  deleteBannerController,
  listBannersController,
  listPublicBannersController,
  updateBannerController,
} from '../controllers/bannerController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';
import { requireUuidParam } from '../middlewares/validateParams.js';

export const bannerRoutes = Router();
bannerRoutes.param('id', requireUuidParam('id'));

bannerRoutes.get('/banners', listPublicBannersController);

const editorial = [requireAuth, requireRoles('EDITOR', 'ADMIN')];
bannerRoutes.get('/editorial/banners', ...editorial, listBannersController);
bannerRoutes.post('/editorial/banners', ...editorial, createBannerController);
bannerRoutes.patch('/editorial/banners/:id', ...editorial, updateBannerController);
bannerRoutes.delete('/editorial/banners/:id', ...editorial, deleteBannerController);
