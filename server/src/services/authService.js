import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import {
  createAccessToken,
  createRefreshToken,
  getRefreshExpiryDate,
  hashToken,
  verifyRefreshToken,
} from '../utils/auth.js';
import { currentUserSelect, toUserDto } from '../utils/userDto.js';
import { reactivateIfExpired } from './accountStatusService.js';

const INVALID_CREDENTIALS = 'Invalid email/username or password';
// Compared against even when the account is missing so response time does not
// reveal whether an email or username exists.
const DUMMY_PASSWORD_HASH = '$2b$10$l4VaO9DVKvOKCv.fyQm/h.baLp9BnWNKYHDCepr7/QM.TIOYVVUUy';

function authError() {
  const error = new Error(INVALID_CREDENTIALS);
  error.statusCode = 401;
  error.code = 'INVALID_CREDENTIALS';
  return error;
}

function assertActiveUser(user) {
  if (!user || user.deletedAt || user.status === 'SUSPENDED' || user.status === 'DELETED') {
    throw authError();
  }
}

async function persistRefreshToken(userId, refreshToken, metadata, transaction = prisma) {
  return transaction.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: getRefreshExpiryDate(refreshToken),
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
    },
  });
}

export async function register(input, metadata) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          email: input.email,
          username: input.username,
          passwordHash,
          status: 'ACTIVE',
          profile: {
            create: { displayName: input.displayName },
          },
        },
        select: currentUserSelect,
      });

      const refreshToken = createRefreshToken(createdUser);
      await persistRefreshToken(createdUser.id, refreshToken, metadata, transaction);

      return { user: createdUser, refreshToken };
    });

    return {
      user: toUserDto(user.user),
      accessToken: createAccessToken(user.user),
      refreshToken: user.refreshToken,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const conflict = new Error('Email or username is already in use');
      conflict.statusCode = 409;
      conflict.code = 'IDENTIFIER_ALREADY_EXISTS';
      throw conflict;
    }
    throw error;
  }
}

export async function login(input, metadata) {
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.identifier }, { username: input.identifier }],
    },
    select: { ...currentUserSelect, passwordHash: true, deletedAt: true, suspendedUntil: true },
  });

  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) throw authError();
  user = await reactivateIfExpired(user);
  assertActiveUser(user);

  const refreshToken = createRefreshToken(user);
  const accessToken = createAccessToken(user);

  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await persistRefreshToken(user.id, refreshToken, metadata, transaction);
  });

  return { user: toUserDto(user), accessToken, refreshToken };
}

export async function refresh(rawToken, metadata) {
  let payload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    throw authError();
  }

  const tokenHash = hashToken(rawToken);
  let storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { ...currentUserSelect, deletedAt: true, suspendedUntil: true } } },
  });

  if (!storedToken || storedToken.userId !== payload.sub || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
    throw authError();
  }
  storedToken = { ...storedToken, user: await reactivateIfExpired(storedToken.user) };
  assertActiveUser(storedToken.user);

  const nextRefreshToken = createRefreshToken(storedToken.user);
  const nextAccessToken = createAccessToken(storedToken.user);
  await prisma.$transaction(async (transaction) => {
    await transaction.refreshToken.update({ where: { id: storedToken.id }, data: { revokedAt: new Date(), lastUsedAt: new Date() } });
    await persistRefreshToken(storedToken.userId, nextRefreshToken, metadata, transaction);
  });

  return { user: toUserDto(storedToken.user), accessToken: nextAccessToken, refreshToken: nextRefreshToken };
}

export async function logout(rawToken) {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAll(userId) {
  const { count } = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { revokedSessions: count };
}

export async function getCurrentUser(userId) {
  let user = await prisma.user.findUnique({ where: { id: userId }, select: { ...currentUserSelect, deletedAt: true, suspendedUntil: true } });
  user = await reactivateIfExpired(user);
  assertActiveUser(user);
  return toUserDto(user);
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
  };
}

export function getRefreshCookieOptions() {
  return {
    ...getAuthCookieOptions(),
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}
