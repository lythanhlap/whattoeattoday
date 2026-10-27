import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

function conflict() { const error = new Error('Collection name already exists'); error.code = 'COLLECTION_CONFLICT'; error.statusCode = 409; return error; }
function notFound() { const error = new Error('Collection not found'); error.code = 'COLLECTION_NOT_FOUND'; error.statusCode = 404; return error; }

const collectionInclude = { _count: { select: { bookmarks: true } } };
const publicRecipeWhere = { status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null, hiddenAt: null, author: { status: 'ACTIVE', deletedAt: null } };

export async function listCollections(ownerId) {
  return prisma.collection.findMany({ where: { ownerId }, orderBy: { updatedAt: 'desc' }, include: collectionInclude });
}

export async function getCollection(id, userId) {
  const base = await prisma.collection.findFirst({ where: { id, OR: [{ visibility: 'PUBLIC' }, ...(userId ? [{ ownerId: userId }] : [])] }, select: { ownerId: true } });
  if (!base) throw notFound();
  return prisma.collection.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      bookmarks: {
        orderBy: { createdAt: 'desc' },
        where: base.ownerId === userId ? undefined : { recipe: publicRecipeWhere },
        include: { recipe: { include: { category: true, author: { select: { id: true, username: true, status: true, profile: { select: { displayName: true } } } } } } },
      },
    },
  });
}

export async function createCollection(ownerId, input) {
  try { return await prisma.collection.create({ data: { ownerId, name: input.name.trim(), description: input.description?.trim() || null, visibility: input.visibility || 'PRIVATE' }, include: collectionInclude }); } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw conflict();
    throw error;
  }
}

export async function updateCollection(ownerId, id, input) {
  const current = await prisma.collection.findFirst({ where: { id, ownerId } });
  if (!current) throw notFound();
  try { return await prisma.collection.update({ where: { id }, data: { ...(input.name !== undefined ? { name: input.name.trim() } : {}), ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}), ...(input.visibility !== undefined ? { visibility: input.visibility } : {}) }, include: collectionInclude }); } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw conflict();
    throw error;
  }
}

export async function deleteCollection(ownerId, id) {
  const deleted = await prisma.collection.deleteMany({ where: { id, ownerId } });
  if (!deleted.count) throw notFound();
}
