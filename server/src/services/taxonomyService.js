import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { slugify } from '../utils/slug.js';

function conflict(label) {
  const error = new Error(`${label} already exists`);
  error.statusCode = 409;
  error.code = 'TAXONOMY_CONFLICT';
  return error;
}

function notFound(label) {
  const error = new Error(`${label} not found`);
  error.statusCode = 404;
  error.code = 'TAXONOMY_NOT_FOUND';
  return error;
}

function handleConflict(error, label) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw conflict(label);
    if (error.code === 'P2025') throw notFound(label);
  }
  throw error;
}

export function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, description: true, _count: { select: { recipes: { where: { deletedAt: null } } } } },
  });
}

export function listTags() {
  return prisma.tag.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, _count: { select: { recipes: true } } },
  });
}

export async function createCategory(input) {
  try {
    return await prisma.category.create({
      data: { name: input.name, slug: input.slug || slugify(input.name), description: input.description ?? null },
    });
  } catch (error) { return handleConflict(error, 'Category'); }
}

export async function updateCategory(id, input) {
  try {
    return await prisma.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug ? { slug: input.slug } : input.name ? { slug: slugify(input.name) } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
  } catch (error) { return handleConflict(error, 'Category'); }
}

export async function deleteCategory(id) {
  try {
    await prisma.category.delete({ where: { id } });
  } catch (error) { handleConflict(error, 'Category'); }
}

export async function createTag(input) {
  try {
    return await prisma.tag.create({
      data: { name: input.name, slug: input.slug || slugify(input.name) },
    });
  } catch (error) { return handleConflict(error, 'Tag'); }
}

export async function updateTag(id, input) {
  try {
    return await prisma.tag.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug ? { slug: input.slug } : input.name ? { slug: slugify(input.name) } : {}),
      },
    });
  } catch (error) { return handleConflict(error, 'Tag'); }
}

export async function deleteTag(id) {
  try {
    await prisma.tag.delete({ where: { id } });
  } catch (error) { handleConflict(error, 'Tag'); }
}
