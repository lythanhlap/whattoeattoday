import { prisma } from '../lib/prisma.js';
function fail(message, code, statusCode) { const error = new Error(message); error.code = code; error.statusCode = statusCode; return error; }
export async function follow(followerId, followingId) { if (followerId === followingId) throw fail('Cannot follow yourself', 'SELF_FOLLOW_FORBIDDEN', 422); const user = await prisma.user.findFirst({ where: { id: followingId, status: 'ACTIVE', deletedAt: null } }); if (!user) throw fail('User not found', 'USER_NOT_FOUND', 404); return prisma.follow.upsert({ where: { followerId_followingId: { followerId, followingId } }, create: { followerId, followingId }, update: {} }); }
export async function unfollow(followerId, followingId) { await prisma.follow.deleteMany({ where: { followerId, followingId } }); }
export async function getProfile(username, viewerId) {
  const publicRecipeWhere = { status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null, hiddenAt: null, author: { status: 'ACTIVE', deletedAt: null } };
  const profile = await prisma.user.findFirst({
    where: { username, status: 'ACTIVE', deletedAt: null },
    select: {
      id: true, username: true, createdAt: true,
      profile: { select: { displayName: true, avatarUrl: true, bio: true } },
      _count: { select: { recipes: { where: publicRecipeWhere }, followsTo: true, followsFrom: true } },
    },
  });
  if (!profile) throw fail('User not found', 'USER_NOT_FOUND', 404);
  const [recipes, cooksnaps, collections, isFollowing] = await Promise.all([
    prisma.recipe.findMany({
      where: { authorId: profile.id, ...publicRecipeWhere },
      orderBy: { publishedAt: 'desc' },
      include: {
        author: { select: { username: true, profile: { select: { displayName: true } } } },
        category: true,
        coverImage: { select: { id: true, secureUrl: true } },
      },
    }),
    prisma.cooksnap.findMany({
      where: {
        authorId: profile.id, status: 'ACTIVE', deletedAt: null,
        recipe: { status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null, hiddenAt: null, author: { status: 'ACTIVE', deletedAt: null } },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, imageUrl: true, caption: true, createdAt: true, recipe: { select: { title: true, slug: true } } },
    }),
    prisma.collection.findMany({
      where: { ownerId: profile.id, visibility: 'PUBLIC' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, description: true, _count: { select: { bookmarks: true } } },
    }),
    viewerId && viewerId !== profile.id ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: profile.id } }, select: { followerId: true } }) : null,
  ]);
  return { ...profile, recipes, cooksnaps, collections, isFollowing: Boolean(isFollowing) };
}

export async function listProfileConnections(username, relation) {
  const profile = await prisma.user.findFirst({ where: { username, status: 'ACTIVE', deletedAt: null }, select: { id: true } });
  if (!profile) throw fail('User not found', 'USER_NOT_FOUND', 404);
  const rows = await prisma.follow.findMany({ where: relation === 'followers' ? { followingId: profile.id, follower: { status: 'ACTIVE', deletedAt: null } } : { followerId: profile.id, following: { status: 'ACTIVE', deletedAt: null } }, orderBy: { createdAt: 'desc' }, include: { follower: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } } }, following: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } } } } });
  return rows.map((row) => relation === 'followers' ? row.follower : row.following);
}

export async function listFeed(userId, page = 1, limit = 20) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;
  const follows = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
  const followingIds = follows.map((item) => item.followingId);
  const recipeWhere = { status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null, hiddenAt: null, author: { status: 'ACTIVE', deletedAt: null }, ...(followingIds.length ? { authorId: { in: followingIds } } : {}) };
  const cooksnapWhere = { status: 'ACTIVE', deletedAt: null, author: { status: 'ACTIVE', deletedAt: null }, recipe: { status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null, hiddenAt: null, author: { status: 'ACTIVE', deletedAt: null } }, ...(followingIds.length ? { authorId: { in: followingIds } } : {}) };
  const [recipeCount, cookSnapCount] = await prisma.$transaction([prisma.recipe.count({ where: recipeWhere }), prisma.cooksnap.count({ where: cooksnapWhere })]);
  const windowSize = skip + take;
  const [recipes, cooksnaps] = await prisma.$transaction([
    prisma.recipe.findMany({ where: recipeWhere, take: windowSize, orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, username: true, profile: { select: { displayName: true } } } }, category: true } }),
    prisma.cooksnap.findMany({ where: cooksnapWhere, take: windowSize, orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, username: true, profile: { select: { displayName: true } } } }, recipe: { select: { id: true, title: true, slug: true } } } }),
  ]);
  const items = [
    ...recipes.map((recipe) => ({ type: 'RECIPE', createdAt: recipe.createdAt, recipe })),
    ...cooksnaps.map((cooksnap) => ({ type: 'COOKSNAP', createdAt: cooksnap.createdAt, cooksnap })),
  ].sort((a, b) => {
    const featuredA = a.type === 'RECIPE' && a.recipe.featuredAt ? 1 : 0; const featuredB = b.type === 'RECIPE' && b.recipe.featuredAt ? 1 : 0;
    if (featuredA !== featuredB) return featuredB - featuredA;
    const scoreA = a.type === 'RECIPE' ? a.recipe.saveCount + a.recipe.cookSnapCount : 0; const scoreB = b.type === 'RECIPE' ? b.recipe.saveCount + b.recipe.cookSnapCount : 0;
    return scoreB - scoreA || new Date(b.createdAt) - new Date(a.createdAt);
  }).slice(skip, skip + take);
  const total = recipeCount + cookSnapCount;
  return { items, meta: { page: currentPage, limit: take, total, totalPages: Math.ceil(total / take), mode: followingIds.length ? 'FOLLOWING' : 'DISCOVERY' } };
}
