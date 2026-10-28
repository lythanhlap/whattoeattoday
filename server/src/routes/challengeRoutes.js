import { Router } from 'express';
import { archiveChallengeController, createChallengeController, getChallengeController, listChallengesController, removeChallengeEntryController, submitChallengeEntryController, updateChallengeController } from '../controllers/challengeController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { optionalAuth } from '../middlewares/optionalAuthMiddleware.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { requireUuidParam } from '../middlewares/validateParams.js';

export const challengeRoutes = Router();
challengeRoutes.param('id', requireUuidParam('id'));
challengeRoutes.param('entryId', requireUuidParam('entryId'));

challengeRoutes.get('/', listChallengesController);
challengeRoutes.get('/:id', optionalAuth, getChallengeController);
challengeRoutes.post('/', requireAuth, requireRoles('EDITOR', 'ADMIN'), createChallengeController);
challengeRoutes.patch('/:id', requireAuth, requireRoles('EDITOR', 'ADMIN'), updateChallengeController);
challengeRoutes.delete('/:id', requireAuth, requireRoles('EDITOR', 'ADMIN'), archiveChallengeController);
challengeRoutes.post('/:id/entries', requireAuth, rateLimit({ max: 20 }), submitChallengeEntryController);
challengeRoutes.delete('/:id/entries/:entryId', requireAuth, removeChallengeEntryController);
