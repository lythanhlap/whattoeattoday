import { prisma } from '../lib/prisma.js';

export function isSuspensionExpired(user, now = new Date()) {
  return Boolean(user?.status === 'SUSPENDED' && user.suspendedUntil && new Date(user.suspendedUntil) <= now);
}

/**
 * Temporary suspensions expire without a background scheduler. The next
 * authenticated request or login reactivates the account atomically.
 */
export async function reactivateIfExpired(user) {
  if (!isSuspensionExpired(user)) return user;
  await prisma.user.update({
    where: { id: user.id },
    data: { status: 'ACTIVE', suspendedUntil: null, suspensionReason: null },
  });
  return { ...user, status: 'ACTIVE', suspendedUntil: null, suspensionReason: null };
}
