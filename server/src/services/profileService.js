import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { currentUserSelect, toUserDto } from '../utils/userDto.js';
import { hashToken } from '../utils/auth.js';

function fail(message, code, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

async function resolveAvatarMedia(transaction, userId, mediaAssetId) {
  if (!mediaAssetId) return null;
  const asset = await transaction.mediaAsset.findFirst({
    where: { id: mediaAssetId, ownerId: userId, status: { in: ['UPLOADED', 'ATTACHED'] }, secureUrl: { not: null } },
    select: { id: true, secureUrl: true },
  });
  if (!asset?.secureUrl) throw fail('Avatar must be an uploaded media asset owned by the user', 'PROFILE_AVATAR_INVALID', 422);
  await transaction.mediaAsset.updateMany({ where: { id: asset.id, status: 'UPLOADED' }, data: { status: 'ATTACHED', attachedAt: new Date() } });
  return asset.secureUrl;
}

export async function updateProfile(userId, input) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const avatarFromMedia = await resolveAvatarMedia(transaction, userId, input.avatarMediaId);
      if (input.username) {
        const existing = await transaction.user.findFirst({
          where: { username: { equals: input.username, mode: 'insensitive' }, id: { not: userId } },
          select: { id: true },
        });
        if (existing) throw fail('Username is already in use', 'USERNAME_ALREADY_EXISTS', 409);
      }
      const user = await transaction.user.update({
        where: { id: userId },
        data: {
          ...(input.username ? { username: input.username } : {}),
          profile: {
            upsert: {
              create: {
                displayName: input.displayName || input.username || 'Thành viên Bếp Nhà',
                bio: input.bio ?? null,
                avatarUrl: avatarFromMedia || input.avatarUrl || null,
              },
              update: {
                ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
                ...(input.bio !== undefined ? { bio: input.bio } : {}),
                ...(avatarFromMedia || input.avatarUrl !== undefined ? { avatarUrl: avatarFromMedia || input.avatarUrl } : {}),
              },
            },
          },
        },
        select: currentUserSelect,
      });
      await transaction.auditLog.create({
        data: { actorId: userId, action: 'PROFILE_UPDATED', targetType: 'USER', targetId: userId, details: { fields: Object.keys(input) } },
      });
      return toUserDto(user);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw fail('Username is already in use', 'USERNAME_ALREADY_EXISTS', 409);
    }
    throw error;
  }
}

export async function changePassword(userId, input, currentRefreshToken) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true } });
  if (!user) throw fail('User not found', 'USER_NOT_FOUND', 404);
  const matches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!matches) throw fail('Current password is incorrect', 'PASSWORD_MISMATCH', 422);

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({ where: { id: userId }, data: { passwordHash } });
    await transaction.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentRefreshToken ? { tokenHash: { not: hashToken(currentRefreshToken) } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    await transaction.auditLog.create({ data: { actorId: userId, action: 'PASSWORD_CHANGED', targetType: 'USER', targetId: userId } });
  });
}
