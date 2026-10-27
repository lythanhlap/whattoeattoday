import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const testEmail = `auth-${Date.now()}@example.com`;
const testUsername = `auth_${Date.now().toString().slice(-8)}`;
let userId;
let accessToken;
let refreshCookie;

before(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: 'auth-' } } });
});

after(async () => {
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

test('register creates user and profile without exposing password data', async () => {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: testEmail,
    username: testUsername,
    password: 'correct horse battery staple',
    displayName: 'Auth Test User',
  });

  assert.equal(response.status, 201);
  assert.ok(response.body.data.accessToken);
  assert.ok(response.headers['set-cookie']);
  assert.equal(response.body.data.user.email, testEmail);
  assert.equal(response.body.data.user.profile.displayName, 'Auth Test User');
  assert.equal(response.body.data.user.passwordHash, undefined);
  assert.equal(response.body.data.user.refreshTokens, undefined);

  userId = response.body.data.user.id;
  accessToken = response.body.data.accessToken;
  refreshCookie = response.headers['set-cookie'][0];

  const storedUser = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true, refreshTokens: true } });
  assert.ok(storedUser.passwordHash !== 'correct horse battery staple');
  assert.equal(storedUser.profile.displayName, 'Auth Test User');
  assert.equal(storedUser.refreshTokens.length, 1);
});

test('duplicate email is rejected case-insensitively', async () => {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: testEmail.toUpperCase(),
    username: `${testUsername}_other`,
    password: 'correct horse battery staple',
    displayName: 'Duplicate Test User',
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'IDENTIFIER_ALREADY_EXISTS');
});

test('login accepts username and rejects invalid credentials generically', async () => {
  const invalidResponse = await request(app).post('/api/v1/auth/login').send({
    identifier: testUsername,
    password: 'wrong password',
  });

  assert.equal(invalidResponse.status, 401);
  assert.equal(invalidResponse.body.error.code, 'INVALID_CREDENTIALS');
  assert.equal(invalidResponse.body.error.message, 'Invalid email/username or password');

  const response = await request(app).post('/api/v1/auth/login').send({
    identifier: testUsername,
    password: 'correct horse battery staple',
  });

  assert.equal(response.status, 200);
  assert.ok(response.body.data.accessToken);
  assert.ok(response.headers['set-cookie']);
  accessToken = response.body.data.accessToken;
  refreshCookie = response.headers['set-cookie'][0];
});

test('suspended users cannot log in', async () => {
  await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });

  const response = await request(app).post('/api/v1/auth/login').send({
    identifier: testUsername,
    password: 'correct horse battery staple',
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');

  await prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
});

test('me returns the authenticated user without sensitive fields', async () => {
  const response = await request(app)
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${accessToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.user.id, userId);
  assert.equal(response.body.data.user.passwordHash, undefined);
  assert.equal(response.body.data.user.email, testEmail);
});

test('refresh rotates the session token', async () => {
  const response = await request(app)
    .post('/api/v1/auth/refresh')
    .set('Cookie', refreshCookie);

  assert.equal(response.status, 200);
  assert.ok(response.body.data.accessToken);
  assert.ok(response.headers['set-cookie']);
  assert.notEqual(response.headers['set-cookie'][0], refreshCookie);
  refreshCookie = response.headers['set-cookie'][0];
  accessToken = response.body.data.accessToken;

  const sessions = await prisma.refreshToken.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  assert.equal(sessions.length, 3);
  assert.equal(sessions.filter((session) => session.revokedAt).length, 1);
  assert.equal(sessions.filter((session) => !session.revokedAt).length, 2);
});

test('logout revokes the current refresh token', async () => {
  const response = await request(app)
    .post('/api/v1/auth/logout')
    .set('Cookie', refreshCookie);

  assert.equal(response.status, 204);
  const activeSessions = await prisma.refreshToken.count({ where: { userId, revokedAt: null } });
  assert.equal(activeSessions, 1);
});
