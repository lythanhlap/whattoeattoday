import { prisma } from '../lib/prisma.js';

const PUBLIC_LIMIT = 6;

const bannerSelect = {
  id: true,
  title: true,
  subtitle: true,
  linkUrl: true,
  sortOrder: true,
  isActive: true,
  startsAt: true,
  endsAt: true,
  createdAt: true,
  updatedAt: true,
  image: { select: { id: true, secureUrl: true, format: true } },
};

function notFound() {
  const error = new Error('Không tìm thấy banner');
  error.statusCode = 404;
  error.code = 'BANNER_NOT_FOUND';
  return error;
}

function invalidImage() {
  const error = new Error('Ảnh banner phải là ảnh do bạn tải lên và đã xác thực');
  error.statusCode = 422;
  error.code = 'BANNER_IMAGE_INVALID';
  return error;
}

function publicWindow(now = new Date()) {
  return [
    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
    { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
  ];
}

export async function listPublicBanners() {
  return prisma.banner.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      image: { deletedAt: null, secureUrl: { not: null } },
      AND: publicWindow(),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: PUBLIC_LIMIT,
    select: bannerSelect,
  });
}

export async function listBanners({ page, limit, status = 'all', q = '' }) {
  const where = {
    deletedAt: null,
    ...(status === 'active' ? { isActive: true } : {}),
    ...(status === 'inactive' ? { isActive: false } : {}),
    ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.banner.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: bannerSelect,
    }),
    prisma.banner.count({ where }),
  ]);
  return { items, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

async function assertOwnedImage(imageId, actorId) {
  const image = await prisma.mediaAsset.findFirst({
    where: { id: imageId, ownerId: actorId, status: { in: ['UPLOADED', 'ATTACHED'] }, secureUrl: { not: null }, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!image) throw invalidImage();
  return image;
}

export async function createBanner(actorId, input) {
  const image = await assertOwnedImage(input.imageId, actorId);
  return prisma.$transaction(async (transaction) => {
    const banner = await transaction.banner.create({
      data: {
        title: input.title,
        subtitle: input.subtitle,
        linkUrl: input.linkUrl,
        imageId: image.id,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        createdById: actorId,
      },
      select: bannerSelect,
    });
    if (image.status === 'UPLOADED') {
      await transaction.mediaAsset.updateMany({
        where: { id: image.id, status: 'UPLOADED' },
        data: { status: 'ATTACHED', attachedAt: new Date() },
      });
    }
    return banner;
  });
}

export async function updateBanner(actorId, bannerId, input) {
  const existing = await prisma.banner.findFirst({ where: { id: bannerId, deletedAt: null }, select: { id: true } });
  if (!existing) throw notFound();

  const image = input.imageId ? await assertOwnedImage(input.imageId, actorId) : null;

  return prisma.$transaction(async (transaction) => {
    const banner = await transaction.banner.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
        ...(input.linkUrl !== undefined ? { linkUrl: input.linkUrl } : {}),
        ...(image ? { imageId: image.id } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      },
      select: bannerSelect,
    });
    if (image?.status === 'UPLOADED') {
      await transaction.mediaAsset.updateMany({
        where: { id: image.id, status: 'UPLOADED' },
        data: { status: 'ATTACHED', attachedAt: new Date() },
      });
    }
    return banner;
  });
}

export async function deleteBanner(bannerId) {
  const result = await prisma.banner.updateMany({ where: { id: bannerId, deletedAt: null }, data: { deletedAt: new Date(), isActive: false } });
  if (!result.count) throw notFound();
}
