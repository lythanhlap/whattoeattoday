import { prisma } from '../lib/prisma.js';
import { reactivateIfExpired } from '../services/accountStatusService.js';
import { verifyAccessToken } from '../utils/auth.js';

export async function requireAuth(request, _response, next) {
  try {
    const authorization = request.get('authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      error.code = 'AUTHENTICATION_REQUIRED';
      throw error;
    }

    const payload = verifyAccessToken(token);
    let user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, status: true, deletedAt: true, suspendedUntil: true } });
    if (user) user = await reactivateIfExpired(user);
    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      error.code = 'AUTHENTICATION_REQUIRED';
      throw error;
    }

    request.auth = { userId: user.id, role: user.role };
    next();
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 401;
      error.code = 'INVALID_ACCESS_TOKEN';
      error.message = 'Authentication required';
    }
    next(error);
  }
}
