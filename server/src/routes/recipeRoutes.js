import { Router } from 'express';
import { createRecipeController, deleteRecipeController, getRecipeController, listRecipesController, publishRecipeController, recordRecipeViewController, suggestRecipesController, updateRecipeController } from '../controllers/recipeController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { optionalAuth } from '../middlewares/optionalAuthMiddleware.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { requireUuidParam } from '../middlewares/validateParams.js';

export const recipeRoutes = Router();
recipeRoutes.param('id', requireUuidParam('id'));

recipeRoutes.get('/', optionalAuth, listRecipesController);
recipeRoutes.post('/', requireAuth, createRecipeController);
recipeRoutes.get('/suggestions', rateLimit({ max: 120 }), suggestRecipesController);
recipeRoutes.post('/:id/view', optionalAuth, recordRecipeViewController);
recipeRoutes.get('/:slug', optionalAuth, getRecipeController);
recipeRoutes.patch('/:id', requireAuth, updateRecipeController);
recipeRoutes.post('/:id/publish', requireAuth, publishRecipeController);
recipeRoutes.delete('/:id', requireAuth, deleteRecipeController);
