import { changePassword, updateProfile } from '../services/profileService.js';
import { validatePasswordChange, validateProfileInput } from '../validators/profileValidator.js';
import { env } from '../config/env.js';

export async function updateProfileController(request, response, next) {
  try {
    const user = await updateProfile(request.auth.userId, validateProfileInput(request.body, { partial: true }));
    response.json({ data: { user }, meta: {}, error: null });
  } catch (error) { next(error); }
}

export async function changePasswordController(request, response, next) {
  try {
    const input = validatePasswordChange(request.body);
    await changePassword(request.auth.userId, input, request.cookies?.[env.authCookieName]);
    response.status(204).send();
  } catch (error) { next(error); }
}
