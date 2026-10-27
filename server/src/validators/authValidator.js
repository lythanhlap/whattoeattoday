const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export function validateRegisterInput(body) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const errors = {};

  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) errors.email = 'Email is invalid';
  if (!USERNAME_PATTERN.test(username)) errors.username = 'Username is invalid';
  if (password.length < 8 || password.length > 72) errors.password = 'Password must be 8 to 72 characters';
  if (displayName.length < 1 || displayName.length > 100) errors.displayName = 'Display name is required';

  if (Object.keys(errors).length > 0) {
    const error = new Error('Validation failed');
    error.statusCode = 422;
    error.code = 'VALIDATION_ERROR';
    error.details = errors;
    throw error;
  }

  return { email, username, password, displayName };
}

export function validateLoginInput(body) {
  const identifier = typeof body.identifier === 'string' ? body.identifier.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!identifier || !password) {
    const error = new Error('Identifier and password are required');
    error.statusCode = 422;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  return { identifier, password };
}
