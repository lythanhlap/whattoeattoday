function validation(details) {
  const error = new Error('Validation failed');
  error.statusCode = 422;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateProfileInput(body = {}, { partial = false } = {}) {
  const errors = {};
  if (!partial || body.username !== undefined) {
    if (typeof body.username !== 'string' || !/^[a-zA-Z0-9._]{3,30}$/.test(body.username)) {
      errors.username = 'Username must be 3 to 30 characters using letters, numbers, dots or underscores';
    }
  }
  if (!partial || body.displayName !== undefined) {
    if (typeof body.displayName !== 'string' || body.displayName.trim().length < 2 || body.displayName.trim().length > 100) {
      errors.displayName = 'Display name must be 2 to 100 characters';
    }
  }
  if (body.bio !== undefined && body.bio !== null && (typeof body.bio !== 'string' || body.bio.length > 500)) {
    errors.bio = 'Bio must be at most 500 characters';
  }
  if (body.avatarUrl !== undefined && body.avatarUrl !== null && body.avatarUrl !== '') {
    if (typeof body.avatarUrl !== 'string' || body.avatarUrl.length > 2048 || !isHttpUrl(body.avatarUrl)) {
      errors.avatarUrl = 'Avatar must be a valid http/https URL';
    }
  }
  if (body.avatarMediaId !== undefined && body.avatarMediaId !== null && (typeof body.avatarMediaId !== 'string' || body.avatarMediaId.length > 64)) {
    errors.avatarMediaId = 'Avatar media id is invalid';
  }
  if (Object.keys(errors).length) throw validation(errors);
  return {
    ...(body.username !== undefined ? { username: body.username.trim() } : {}),
    ...(body.displayName !== undefined ? { displayName: body.displayName.trim() } : {}),
    ...(body.bio !== undefined ? { bio: body.bio?.trim() || null } : {}),
    ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl?.trim() || null } : {}),
    ...(body.avatarMediaId !== undefined ? { avatarMediaId: body.avatarMediaId || null } : {}),
  };
}

export function validatePasswordChange(body = {}) {
  const errors = {};
  if (typeof body.currentPassword !== 'string' || body.currentPassword.length < 1) {
    errors.currentPassword = 'Current password is required';
  }
  if (typeof body.newPassword !== 'string' || body.newPassword.length < 8 || body.newPassword.length > 72) {
    errors.newPassword = 'New password must be 8 to 72 characters';
  }
  if (body.currentPassword && body.newPassword && body.currentPassword === body.newPassword) {
    errors.newPassword = 'New password must be different from the current password';
  }
  if (Object.keys(errors).length) throw validation(errors);
  return { currentPassword: body.currentPassword, newPassword: body.newPassword };
}
