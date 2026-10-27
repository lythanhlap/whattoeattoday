import { archiveChallenge, createChallenge, getChallenge, listChallenges, removeChallengeEntry, submitChallengeEntry, updateChallenge } from '../services/challengeService.js';
import { validateChallengeEntryInput, validateChallengeInput } from '../validators/challengeValidator.js';

export async function listChallengesController(request, response, next) {
  try {
    const result = await listChallenges(request.query);
    response.json({ data: result.items, meta: result.meta, error: null });
  } catch (error) { next(error); }
}

export async function getChallengeController(request, response, next) {
  try {
    const challenge = await getChallenge(request.params.id, request.auth || {});
    response.json({ data: { challenge }, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function createChallengeController(request, response, next) {
  try {
    const challenge = await createChallenge(request.auth.userId, request.auth.role, validateChallengeInput(request.body));
    response.status(201).json({ data: { challenge }, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function updateChallengeController(request, response, next) {
  try {
    const challenge = await updateChallenge(request.auth.userId, request.auth.role, request.params.id, validateChallengeInput(request.body, { partial: true }));
    response.json({ data: { challenge }, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function archiveChallengeController(request, response, next) {
  try {
    const challenge = await archiveChallenge(request.auth.userId, request.auth.role, request.params.id);
    response.json({ data: { challenge }, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function submitChallengeEntryController(request, response, next) {
  try {
    const entry = await submitChallengeEntry(request.auth.userId, request.params.id, validateChallengeEntryInput(request.body).recipeId);
    response.status(201).json({ data: { entry }, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function removeChallengeEntryController(request, response, next) {
  try {
    await removeChallengeEntry(request.auth.userId, request.auth.role, request.params.id, request.params.entryId);
    response.status(204).send();
  } catch (error) { next(error); }
}
