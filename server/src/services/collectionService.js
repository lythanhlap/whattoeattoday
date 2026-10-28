import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

function conflict() { const error = new Error('Collection name already exists'); error.code = 'COLLECTION_CONFLICT'; error.statusCode = 409; return error; }
function notFound() { const error = new Error('Collection not found'); error.code = 'COLLECTION_NOT_FOUND'; error.statusCode = 404; return error; }

const collectionInclude = { _count: { select: { bookmarks: true } }, coverImage: { select: { id: true, secureUrl: true, format: true } } };
const publicRecipeWhere = { status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null, hiddenAt: null, author: { status: 'ACTIVE', deletedAt: null } };

function invalidCover() {
  const error = new Error('Cover image must be an uploaded media asset owned by the collection owner');
  error.statusCode = 422;
  error.code = 'COLLECTION_COVER_INVALID';
  return error;
}

async function assertCoverImage(client, ownerId, coverImageId) {
  if (!coverImageId) return;
  const asset = await client.mediaAsset.findFirst({
    where: { id: coverImageId, ownerId, status: { in: ['UPLOADED', 'ATTACHED'] } },
    select: { id: true },
  });
  if (!asset) throw invalidCover();
}

async function attachCoverImage(client, coverImageId) {
  if (!coverImageId) return;
  await client.mediaAsset.updateMany({
    where: { id: coverImageId, status: 'UPLOADED' },
    data: { status: 'ATTACHED', attachedAt: new Date() },
  });
}

export async function listCollections(ownerId) {
  return prisma.collection.findMany({ where: { ownerId }, orderBy: { updatedAt: 'desc' }, include: collectionInclude });
}

export async function getCollection(id, userId, userRole) {
  const isAdmin = userRole === 'ADMIN';
  const base = await prisma.collection.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : {
        OR: [
          ...(userId ? [{ ownerId: userId }] : []),
          { visibility: 'PUBLIC', owner: { status: 'ACTIVE', deletedAt: null } },
        ],
      }),
    },
    select: { ownerId: true },
  });
  if (!base) throw notFound();
  const canViewAll = isAdmin || base.ownerId === userId;
  return prisma.collection.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      coverImage: { select: { id: true, secureUrl: true, format: true } },
      bookmarks: {
        orderBy: { createdAt: 'desc' },
        where: canViewAll ? undefined : { recipe: publicRecipeWhere },
        include: { recipe: { include: { category: true, author: { select: { id: true, username: true, status: true, profile: { select: { displayName: true } } } } } } },
      },
    },
  });
}

export async function createCollection(ownerId, input) {
  try {
    return await prisma.$transaction(async (transaction) => {
      await assertCoverImage(transaction, ownerId, input.coverImageId || null);
      const collection = await transaction.collection.create({
        data: {
          ownerId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          coverImageId: input.coverImageId || null,
          visibility: input.visibility || 'PRIVATE',
        },
        include: collectionInclude,
      });
      await attachCoverImage(transaction, input.coverImageId || null);
      return collection;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw conflict();
    throw error;
  }
}

export async function updateCollection(ownerId, id, input) {
  const current = await prisma.collection.findFirst({ where: { id, ownerId } });
  if (!current) throw notFound();
  try {
    return await prisma.$transaction(async (transaction) => {
      if (input.coverImageId) await assertCoverImage(transaction, ownerId, input.coverImageId);
      const collection = await transaction.collection.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
          ...(input.coverImageId !== undefined ? { coverImageId: input.coverImageId || null } : {}),
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        },
        include: collectionInclude,
      });
      await attachCoverImage(transaction, input.coverImageId || null);
      return collection;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw conflict();
    throw error;
  }
}

export async function deleteCollection(ownerId, id) {
  const deleted = await prisma.collection.deleteMany({ where: { id, ownerId } });
  if (!deleted.count) throw notFound();
}
