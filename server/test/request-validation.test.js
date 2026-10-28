import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const suffix = Date.now().toString().slice(-8);
let userId;

after(async () => {
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

test('invalid uuid route params return a validation error instead of a server error', async () => {
  const collection = await request(app).get('/api/v1/collections/khong-phai-uuid');
  assert.equal(collection.status, 422);
  assert.equal(collection.body.error.code, 'VALIDATION_ERROR');
  assert.equal(collection.body.error.details.id, 'id must be a valid UUID');

  const challenge = await request(app).get('/api/v1/challenges/khong-phai-uuid');
  assert.equal(challenge.status, 422);
  assert.equal(challenge.body.error.code, 'VALIDATION_ERROR');

  const recipeView = await request(app).post('/api/v1/recipes/khong-phai-uuid/view');
  assert.equal(recipeView.status, 422);
  assert.equal(recipeView.body.error.code, 'VALIDATION_ERROR');
});

test('missing resources with a valid uuid still return a domain not-found error', async () => {
  const response = await request(app).get('/api/v1/collections/00000000-0000-4000-8000-000000000000');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'COLLECTION_NOT_FOUND');
});

test('invalid uuid values in request bodies never expose internal prisma codes', async () => {
  const register = await request(app).post('/api/v1/auth/register').send({
    email: `validation-${suffix}@example.com`,
    username: `validation_${suffix}`,
    password: 'correct horse battery staple',
    displayName: 'Validation User',
  });
  assert.equal(register.status, 201);
  userId = register.body.data.user.id;

  const response = await request(app)
    .post('/api/v1/recipes')
    .set('Authorization', `Bearer ${register.body.data.accessToken}`)
    .send({
      title: 'Công thức kiểm tra định danh',
      categoryId: 'khong-phai-uuid',
      ingredients: [{ displayName: 'Rau' }],
      steps: [{ instruction: 'Nấu chín.' }],
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_IDENTIFIER');
  assert.equal(response.body.error.message, 'Identifier is invalid');
  assert.equal(response.body.error.code === 'P2023', false);
});
