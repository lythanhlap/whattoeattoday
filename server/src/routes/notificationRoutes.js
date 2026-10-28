import { Router } from 'express';
import { listNotificationsController, markAllNotificationsReadController, markNotificationReadController } from '../controllers/notificationController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { requireUuidParam } from '../middlewares/validateParams.js';

export const notificationRoutes = Router();
notificationRoutes.param('id', requireUuidParam('id'));
notificationRoutes.use(requireAuth);
notificationRoutes.get('/', listNotificationsController);
notificationRoutes.patch('/:id/read', markNotificationReadController);
notificationRoutes.post('/read-all', markAllNotificationsReadController);
