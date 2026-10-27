import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const suffix = Date.now().toString().slice(-8);
const users = [];
const recipeIds = [];

async function createUser(label) {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: `feed-rank-${label}-${suffix}@example.com`,
    username: `fr_${label}_${suffix}`,
    password: 'correct horse battery staple',
    displayName: `Feed Rank ${label}`,
  });
  assert.equal(response.status, 201);
  users.push(response.body.data.user.id);
  return { id: response.body.data.user.id, token: response.body.data.accessToken };
}

async function createRecipe(author, label) {
  const response = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({
    title: `Feed ranking ${label} ${suffix}`,
    ingredients: [{ displayName: 'Rau củ' }],
    steps: [{ instruction: 'Nấu chín.' }],
  });
  assert.equal(response.status, 201);
  const recipe = response.body.data.recipe;
  recipeIds.push(recipe.id);
  await prisma.recipe.update({ where: { id: recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
  return recipe;
}

after(async () => {
  await prisma.follow.deleteMany({ where: { OR: [{ followerId: { in: users } }, { followingId: { in: users } }] } });
  await prisma.recipe.deleteMany({ where: { authorId: { in: users } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

test('feed pagination stays stable and keeps popular older recipes visible at scale', async () => {
  const author = await createUser('bulkauthor');
  const follower = await createUser('bulkfollower');
  const followed = await request(app).post(`/api/v1/users/${author.id}/follow`).set('Authorization', `Bearer ${follower.token}`);
  assert.equal(followed.status, 204);

  const now = Date.now();
  const records = Array.from({ length: 120 }, (_, index) => ({
    authorId: author.id,
    title: `Bulk feed ${index} ${suffix}`,
    slug: `bulk-feed-${index}-${suffix}`,
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    createdAt: new Date(now - index * 60_000),
    publishedAt: new Date(now - index * 60_000),
    saveCount: 0,
    cookSnapCount: 0,
  }));
  await prisma.recipe.createMany({ data: records });
  const oldest = await prisma.recipe.findFirst({ where: { authorId: author.id, slug: `bulk-feed-119-${suffix}` }, select: { id: true } });
  await prisma.recipe.update({ where: { id: oldest.id }, data: { saveCount: 500 } });

  const firstPage = await request(app).get('/api/v1/me/feed?page=1&limit=10').set('Authorization', `Bearer ${follower.token}`);
  assert.equal(firstPage.status, 200);
  assert.equal(firstPage.body.meta.total, 120);
  assert.equal(firstPage.body.meta.totalPages, 12);
  assert.equal(firstPage.body.data[0].recipe.id, oldest.id);

  const seen = new Set();
  for (let page = 1; page <= 12; page += 1) {
    const response = await request(app).get(`/api/v1/me/feed?page=${page}&limit=10`).set('Authorization', `Bearer ${follower.token}`);
    assert.equal(response.status, 200);
    for (const event of response.body.data) {
      assert.equal(seen.has(event.recipe.id), false, `duplicate recipe ${event.recipe.id} on page ${page}`);
      seen.add(event.recipe.id);
    }
  }
  assert.equal(seen.size, 120);

  const beyond = await request(app).get('/api/v1/me/feed?page=13&limit=10').set('Authorization', `Bearer ${follower.token}`);
  assert.equal(beyond.status, 200);
  assert.equal(beyond.body.data.length, 0);
  assert.equal(beyond.body.meta.total, 120);
});

test('feed ranks featured recipes first, then popularity, and paginates deterministically', async () => {
  const author = await createUser('author');
  const follower = await createUser('follower');

  const normal = await createRecipe(author, 'normal');
  const popular = await createRecipe(author, 'popular');
  const featured = await createRecipe(author, 'featured');
  await prisma.recipe.update({ where: { id: popular.id }, data: { saveCount: 40, cookSnapCount: 12 } });
  await prisma.recipe.update({ where: { id: featured.id }, data: { featuredAt: new Date() } });

  const followed = await request(app).post(`/api/v1/users/${author.id}/follow`).set('Authorization', `Bearer ${follower.token}`);
  assert.equal(followed.status, 204);

  const firstPage = await request(app).get('/api/v1/me/feed?page=1&limit=2').set('Authorization', `Bearer ${follower.token}`);
  assert.equal(firstPage.status, 200);
  assert.equal(firstPage.body.meta.mode, 'FOLLOWING');
  assert.equal(firstPage.body.meta.total >= 3, true);
  const firstIds = firstPage.body.data.map((event) => event.recipe?.id).filter(Boolean);
  assert.equal(firstIds[0], featured.id);
  assert.equal(firstIds[1], popular.id);

  const secondPage = await request(app).get('/api/v1/me/feed?page=2&limit=2').set('Authorization', `Bearer ${follower.token}`);
  assert.equal(secondPage.status, 200);
  const secondIds = secondPage.body.data.map((event) => event.recipe?.id).filter(Boolean);
  assert.equal(secondIds.includes(normal.id), true);
  assert.equal(secondIds.includes(featured.id), false);
});
