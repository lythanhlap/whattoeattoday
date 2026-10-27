import { Router } from 'express';
import { createRecipeController, deleteRecipeController, getRecipeController, listRecipesController, publishRecipeController, recordRecipeViewController, updateRecipeController } from '../controllers/recipeController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { optionalAuth } from '../middlewares/optionalAuthMiddleware.js';

export const recipeRoutes = Router();

recipeRoutes.get('/', optionalAuth, listRecipesController);
recipeRoutes.post('/', requireAuth, createRecipeController);
recipeRoutes.post('/:id/view', optionalAuth, recordRecipeViewController);
recipeRoutes.get('/:slug', optionalAuth, getRecipeController);
recipeRoutes.patch('/:id', requireAuth, updateRecipeController);
recipeRoutes.post('/:id/publish', requireAuth, publishRecipeController);
recipeRoutes.delete('/:id', requireAuth, deleteRecipeController);
