const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuidParam(name = 'id') {
  return function validateUuidParam(request, _response, next, value) {
    void request;
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      const error = new Error(`${name} must be a valid UUID`);
      error.statusCode = 422;
      error.code = 'VALIDATION_ERROR';
      error.details = { [name]: `${name} must be a valid UUID` };
      return next(error);
    }
    return next();
  };
}
