import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../utils/auth.js';

export async function optionalAuth(request, _response, next) {
  const authorization = request.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, status: true, deletedAt: true } });
    if (user && user.status === 'ACTIVE' && !user.deletedAt) request.auth = { userId: user.id, role: user.role };
  } catch {
    // Public reads remain available when an optional access token is stale.
  }
  return next();
}
