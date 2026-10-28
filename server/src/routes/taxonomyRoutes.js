import { Router } from 'express';
import {
  createCategoryController,
  createTagController,
  deleteCategoryController,
  deleteTagController,
  listCategoriesController,
  listTagsController,
  updateCategoryController,
  updateTagController,
} from '../controllers/taxonomyController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';
import { requireUuidParam } from '../middlewares/validateParams.js';

export const taxonomyRoutes = Router();
taxonomyRoutes.param('id', requireUuidParam('id'));
taxonomyRoutes.get('/categories', listCategoriesController);
taxonomyRoutes.get('/tags', listTagsController);

const editorial = [requireAuth, requireRoles('EDITOR', 'ADMIN')];
taxonomyRoutes.post('/categories', ...editorial, createCategoryController);
taxonomyRoutes.patch('/categories/:id', ...editorial, updateCategoryController);
taxonomyRoutes.delete('/categories/:id', ...editorial, deleteCategoryController);
taxonomyRoutes.post('/tags', ...editorial, createTagController);
taxonomyRoutes.patch('/tags/:id', ...editorial, updateTagController);
taxonomyRoutes.delete('/tags/:id', ...editorial, deleteTagController);
