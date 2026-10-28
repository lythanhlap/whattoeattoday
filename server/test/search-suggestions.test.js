import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const suffix = Date.now().toString().slice(-8);
const users = [];
const recipeIds = [];
const tagIds = [];
const categoryIds = [];

async function createUser(label) {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: `suggest-${label}-${suffix}@example.com`,
    username: `suggest_${label}_${suffix}`,
    password: 'correct horse battery staple',
    displayName: `Suggest ${label}`,
  });
  assert.equal(response.status, 201);
  users.push(response.body.data.user.id);
  return { id: response.body.data.user.id, token: response.body.data.accessToken };
}

async function createRecipe(author, title, overrides = {}) {
  const response = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({
    title,
    ingredients: [{ displayName: 'Bánh phở' }],
    steps: [{ instruction: 'Nấu nước dùng.' }],
  });
  assert.equal(response.status, 201);
  const recipe = response.body.data.recipe;
  recipeIds.push(recipe.id);
  await prisma.recipe.update({ where: { id: recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date(), ...overrides } });
  return recipe;
}

after(async () => {
  await prisma.recipe.deleteMany({ where: { id: { in: recipeIds } } });
  await prisma.tag.deleteMany({ where: { id: { in: tagIds } } });
  await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

test('suggestions match titles without diacritics and skip non-public content', async () => {
  const author = await createUser('author');
  const publicRecipe = await createRecipe(author, `Phở bò gia truyền ${suffix}`);
  const privateRecipe = await createRecipe(author, `Phở gà riêng tư ${suffix}`, { visibility: 'PRIVATE' });
  const hiddenRecipe = await createRecipe(author, `Phở cuốn bị ẩn ${suffix}`, { hiddenAt: new Date() });

  const response = await request(app).get('/api/v1/recipes/suggestions').query({ q: 'pho bo' });

  assert.equal(response.status, 200);
  assert.equal(response.body.meta.query, 'pho bo');
  assert.ok(Array.isArray(response.body.data));
  const labels = response.body.data.map((item) => item.label);
  assert.ok(labels.includes(publicRecipe.title));
  assert.ok(!labels.includes(privateRecipe.title));
  assert.ok(!labels.includes(hiddenRecipe.title));

  const match = response.body.data.find((item) => item.slug === publicRecipe.slug);
  assert.equal(match.type, 'RECIPE');
});

test('suggestions include tags and categories after recipe matches', async () => {
  const author = await createUser('taxonomy');
  await createRecipe(author, `Phở bò nấu nhanh ${suffix}`);
  const tag = await prisma.tag.create({ data: { name: `Phở chay ${suffix}`, slug: `pho-chay-${suffix}` } });
  const category = await prisma.category.create({ data: { name: `Phở nước ${suffix}`, slug: `pho-nuoc-${suffix}` } });
  tagIds.push(tag.id);
  categoryIds.push(category.id);

  const response = await request(app).get('/api/v1/recipes/suggestions').query({ q: 'pho', limit: 10 });

  assert.equal(response.status, 200);
  const types = response.body.data.map((item) => item.type);
  assert.ok(types.includes('RECIPE'));
  assert.ok(types.includes('TAG'));
  assert.ok(types.includes('CATEGORY'));
  assert.equal(types[0], 'RECIPE');
  assert.equal(response.body.data.find((item) => item.type === 'TAG').slug, tag.slug);
});

test('suggestion validation rejects short queries and oversized limits', async () => {
  const missingQuery = await request(app).get('/api/v1/recipes/suggestions');
  assert.equal(missingQuery.status, 422);
  assert.equal(missingQuery.body.error.code, 'VALIDATION_ERROR');

  const shortQuery = await request(app).get('/api/v1/recipes/suggestions').query({ q: 'p' });
  assert.equal(shortQuery.status, 422);
  assert.equal(shortQuery.body.error.details.q, 'Search query must be 2 to 100 characters');

  const oversizedLimit = await request(app).get('/api/v1/recipes/suggestions').query({ q: 'pho', limit: 11 });
  assert.equal(oversizedLimit.status, 422);
  assert.equal(oversizedLimit.body.error.details.limit, 'Limit must be an integer between 1 and 10');
});

test('suggestions respect the requested limit and keep public results', async () => {
  const author = await createUser('limit');
  await createRecipe(author, `Phở bò số một ${suffix}`);
  await createRecipe(author, `Phở bò số hai ${suffix}`);

  const response = await request(app).get('/api/v1/recipes/suggestions').query({ q: 'pho bo', limit: 1 });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.meta.limit, 1);
});
