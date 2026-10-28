import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();

after(async () => {
  await prisma.$disconnect();
});

test('health endpoint reports the service is running with the shared response shape', async () => {
  const response = await request(app).get('/api/v1/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'ok');
  assert.deepEqual(response.body.meta, {});
  assert.equal(response.body.error, null);
});

test('unknown API routes return the not-found error contract', async () => {
  const response = await request(app).get('/api/v1/khong-ton-tai');

  assert.equal(response.status, 404);
  assert.equal(response.body.data, null);
  assert.equal(response.body.error.code, 'ROUTE_NOT_FOUND');
});
