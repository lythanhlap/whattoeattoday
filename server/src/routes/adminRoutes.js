import { Router } from 'express';
import { adminAuditLogsController, bulkContentActionController, contentActionController, contentDashboardController, contentStatsController, featureRecipeController, listContentController, listUsersController, suspendUserController, updateUserController, warnUserController } from '../controllers/adminController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';

export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireRoles('ADMIN'));
adminRoutes.get('/users', listUsersController);
adminRoutes.patch('/users/:id', updateUserController);
adminRoutes.post('/users/:id/warn', warnUserController);
adminRoutes.post('/users/:id/suspend', suspendUserController);
adminRoutes.get('/audit-logs', adminAuditLogsController);
adminRoutes.get('/content-stats', contentStatsController);
adminRoutes.get('/content', listContentController);
adminRoutes.post('/content/bulk', bulkContentActionController);
adminRoutes.post('/content/:type/:id/action', contentActionController);
adminRoutes.patch('/recipes/:id/featured', featureRecipeController);
adminRoutes.get('/content-dashboard', contentDashboardController);
