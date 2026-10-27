export function requireRoles(...roles) {
  return (request, _response, next) => {
    if (!request.auth || !roles.includes(request.auth.role)) {
      const error = new Error('You do not have permission to perform this action');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      return next(error);
    }
    return next();
  };
}
