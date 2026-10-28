import { Router } from 'express';
import {
  loginController,
  logoutAllController,
  logoutController,
  meController,
  refreshController,
  registerController,
} from '../controllers/authController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { changePasswordController } from '../controllers/profileController.js';

export const authRoutes = Router();

authRoutes.post('/register', rateLimit({ max: 30 }), registerController);
authRoutes.post('/login', rateLimit({ max: 30 }), loginController);
authRoutes.post('/refresh', refreshController);
authRoutes.post('/logout', logoutController);
authRoutes.post('/logout-all', requireAuth, rateLimit({ max: 10 }), logoutAllController);
authRoutes.get('/me', requireAuth, meController);
authRoutes.post('/change-password', requireAuth, rateLimit({ max: 10 }), changePasswordController);
