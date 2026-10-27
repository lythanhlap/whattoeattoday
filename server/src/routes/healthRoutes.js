import { Router } from 'express';
import { getHealth, getRedisHealth } from '../controllers/healthController.js';

export const healthRoutes = Router();

healthRoutes.get('/health', getHealth);
healthRoutes.get('/health/redis', getRedisHealth);
