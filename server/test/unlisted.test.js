import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const suffix = Date.now().toString().slice(-8);
const users = [];

async function createUser(label) {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: `unlisted-${label}-${suffix}@example.com`,
    username: `unlisted_${label}_${suffix}`,
    password: 'correct horse battery staple',
    displayName: `Unlisted ${label}`,
  });
  assert.equal(response.status, 201);
  users.push(response.body.data.user.id);
  return { id: response.body.data.user.id, username: response.body.data.user.username, token: response.body.data.accessToken };
}

after(async () => {
  if (users.length) {
    // Restrict relations (media, reports, comments, cooksnaps) have to go first,
    // otherwise the user delete fails silently and leaves fixtures in the dev database.
    await prisma.report.deleteMany({ where: { OR: [{ reporterId: { in: users } }, { resolvedBy: { in: users } }] } });
    await prisma.comment.deleteMany({ where: { authorId: { in: users } } });
    await prisma.cooksnap.deleteMany({ where: { authorId: { in: users } } });
    await prisma.bookmark.deleteMany({ where: { userId: { in: users } } });
    await prisma.collection.deleteMany({ where: { ownerId: { in: users } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await prisma.challengeEntry.deleteMany({ where: { submittedById: { in: users } } });
    await prisma.recipe.deleteMany({ where: { authorId: { in: users } } });
    await prisma.mediaAsset.deleteMany({ where: { ownerId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  }
  await prisma.$disconnect();
});

test('UNLISTED recipe is accessible by slug but hidden from search and listing', async () => {
  const author = await createUser('author');
  const guest = await createUser('guest');

  // Tạo recipe UNLISTED
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({
    title: 'Món UNLISTED fixture',
    description: 'Recipe này chỉ chia sẻ qua link',
    visibility: 'UNLISTED',
    ingredients: [{ displayName: 'Nguyên liệu UNLISTED' }],
    steps: [{ instruction: 'Bước UNLISTED.' }],
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.recipe.visibility, 'UNLISTED');
  assert.equal(created.body.data.recipe.status, 'DRAFT');

  const recipeId = created.body.data.recipe.id;
  const slug = created.body.data.recipe.slug;

  // Thêm cover và publish
  const cover = await prisma.mediaAsset.create({
    data: {
      ownerId: author.id,
      providerPublicId: `test/${author.id}/unlisted-cover`,
      secureUrl: 'https://res.cloudinary.com/demo/image/upload/unlisted.jpg',
      format: 'jpg',
      bytes: 1024,
    },
  });
  await request(app).patch(`/api/v1/recipes/${recipeId}`).set('Authorization', `Bearer ${author.token}`).send({ coverImageId: cover.id });
  const published = await request(app).post(`/api/v1/recipes/${recipeId}/publish`).set('Authorization', `Bearer ${author.token}`);
  assert.equal(published.status, 200);
  assert.equal(published.body.data.recipe.visibility, 'UNLISTED');

  // Editor duyệt recipe
  const editor = await createUser('editor');
  await prisma.user.update({ where: { id: editor.id }, data: { role: 'EDITOR' } });
  const approved = await request(app).post(`/api/v1/moderation/recipes/${recipeId}/review`).set('Authorization', `Bearer ${editor.token}`).send({
    action: 'APPROVE',
    note: 'UNLISTED approved',
  });
  assert.equal(approved.status, 200);

  // Verify visibility vẫn là UNLISTED sau khi approve
  const afterApprove = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { visibility: true, status: true } });
  assert.equal(afterApprove.visibility, 'UNLISTED');
  assert.equal(afterApprove.status, 'PUBLISHED');

  // UNLISTED KHÔNG xuất hiện trong search
  const searchByTitle = await request(app).get('/api/v1/recipes').query({ q: 'UNLISTED fixture' });
  assert.equal(searchByTitle.status, 200);
  assert.equal(searchByTitle.body.data.some((recipe) => recipe.id === recipeId), false);

  // UNLISTED KHÔNG xuất hiện trong listing public
  const publicList = await request(app).get('/api/v1/recipes');
  assert.equal(publicList.status, 200);
  assert.equal(publicList.body.data.some((recipe) => recipe.id === recipeId), false);

  // UNLISTED accessible qua slug (guest)
  const directAccess = await request(app).get(`/api/v1/recipes/${slug}`);
  assert.equal(directAccess.status, 200);
  assert.equal(directAccess.body.data.recipe.id, recipeId);
  assert.equal(directAccess.body.data.recipe.visibility, 'UNLISTED');

  // UNLISTED accessible qua slug (logged-in guest)
  const loggedInAccess = await request(app).get(`/api/v1/recipes/${slug}`).set('Authorization', `Bearer ${guest.token}`);
  assert.equal(loggedInAccess.status, 200);
  assert.equal(loggedInAccess.body.data.recipe.id, recipeId);
});

test('UNLISTED recipe does not accept public interactions like cooksnap', async () => {
  const tid = Math.random().toString(36).slice(2, 10);
  
  const authorResp = await request(app).post('/api/v1/auth/register').send({
    email: `ula${tid}@example.com`,
    username: `ula${tid}`,
    password: 'correct horse battery staple',
    displayName: 'Author UL',
  });
  assert.equal(authorResp.status, 201);
  users.push(authorResp.body.data.user.id);
  const author = { id: authorResp.body.data.user.id, token: authorResp.body.data.accessToken };

  const memberResp = await request(app).post('/api/v1/auth/register').send({
    email: `ulm${tid}@example.com`,
    username: `ulm${tid}`,
    password: 'correct horse battery staple',
    displayName: 'Member UL',
  });
  assert.equal(memberResp.status, 201);
  users.push(memberResp.body.data.user.id);
  const member = { id: memberResp.body.data.user.id, token: memberResp.body.data.accessToken };

  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({
    title: 'Recipe UNLISTED không tương tác',
    visibility: 'UNLISTED',
    ingredients: [{ displayName: 'Nguyên liệu' }],
    steps: [{ instruction: 'Bước.' }],
  });
  const recipeId = created.body.data.recipe.id;

  const cover = await prisma.mediaAsset.create({
    data: {
      ownerId: author.id,
      providerPublicId: `test/${author.id}/unlisted-no-interaction`,
      secureUrl: 'https://res.cloudinary.com/demo/image/upload/unlisted2.jpg',
      format: 'jpg',
      bytes: 1024,
    },
  });
  await request(app).patch(`/api/v1/recipes/${recipeId}`).set('Authorization', `Bearer ${author.token}`).send({ coverImageId: cover.id });
  await request(app).post(`/api/v1/recipes/${recipeId}/publish`).set('Authorization', `Bearer ${author.token}`);

  // Editor duyệt
  const editor = await createUser('unlisteditor');
  await prisma.user.update({ where: { id: editor.id }, data: { role: 'EDITOR' } });
  await request(app).post(`/api/v1/moderation/recipes/${recipeId}/review`).set('Authorization', `Bearer ${editor.token}`).send({ action: 'APPROVE' });

  // Member không thể tạo cooksnap trên UNLISTED recipe
  const cooksnapAttempt = await request(app).post(`/api/v1/recipes/${recipeId}/cooksnaps`).set('Authorization', `Bearer ${member.token}`).send({
    imageUrl: 'https://storage.example/cooksnap-unlisted.jpg',
    caption: 'Đã nấu UNLISTED',
  });
  assert.equal(cooksnapAttempt.status, 404);
  assert.equal(cooksnapAttempt.body.error.code, 'RECIPE_NOT_FOUND');

  // Member không thể comment trên UNLISTED recipe
  const commentAttempt = await request(app).post(`/api/v1/recipes/${recipeId}/comments`).set('Authorization', `Bearer ${member.token}`).send({
    content: 'Bình luận trên UNLISTED',
  });
  assert.equal(commentAttempt.status, 404);
  assert.equal(commentAttempt.body.error.code, 'RECIPE_NOT_FOUND');
});
