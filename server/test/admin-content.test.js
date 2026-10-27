import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const suffix = Date.now().toString().slice(-8);
const users = [];
const recipes = [];
const comments = [];
const cooksnaps = [];

async function createUser(label) {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: `admin-content-${label}-${suffix}@example.com`,
    username: `ac_${label}_${suffix}`,
    password: 'correct horse battery staple',
    displayName: `Admin Content ${label}`,
  });
  assert.equal(response.status, 201);
  users.push(response.body.data.user.id);
  return { id: response.body.data.user.id, username: response.body.data.user.username, token: response.body.data.accessToken };
}

async function createPublishedRecipe(author, title) {
  const response = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({
    title,
    ingredients: [{ displayName: 'Nguyên liệu kiểm thử', quantity: '1', unit: 'phần' }],
    steps: [{ instruction: 'Nấu chín và thưởng thức.' }],
  });
  assert.equal(response.status, 201);
  const recipe = response.body.data.recipe;
  await prisma.recipe.update({ where: { id: recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
  recipes.push(recipe.id);
  return recipe;
}

async function createComment(author, recipe, content) {
  const response = await request(app).post(`/api/v1/recipes/${recipe.id}/comments`).set('Authorization', `Bearer ${author.token}`).send({ content });
  assert.equal(response.status, 201);
  comments.push(response.body.data.comment.id);
  return response.body.data.comment;
}

async function createCooksnap(author, recipe) {
  const response = await request(app).post(`/api/v1/recipes/${recipe.id}/cooksnaps`).set('Authorization', `Bearer ${author.token}`).send({ imageUrl: `https://storage.example/${suffix}-cooksnap.jpg`, caption: 'Món đã nấu thử.' });
  assert.equal(response.status, 201);
  cooksnaps.push(response.body.data.cooksnap.id);
  return response.body.data.cooksnap;
}

after(async () => {
  const targetIds = [...users, ...recipes, ...comments, ...cooksnaps];
  await prisma.notification.deleteMany({ where: { userId: { in: users } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: users } }, { targetId: { in: targetIds } }] } });
  await prisma.report.deleteMany({ where: { reporterId: { in: users } } });
  await prisma.comment.deleteMany({ where: { OR: [{ authorId: { in: users } }, { recipeId: { in: recipes } }] } });
  await prisma.cooksnap.deleteMany({ where: { OR: [{ authorId: { in: users } }, { recipeId: { in: recipes } }] } });
  await prisma.bookmark.deleteMany({ where: { userId: { in: users } } });
  await prisma.collection.deleteMany({ where: { ownerId: { in: users } } });
  await prisma.follow.deleteMany({ where: { OR: [{ followerId: { in: users } }, { followingId: { in: users } }] } });
  await prisma.challengeEntry.deleteMany({ where: { submittedById: { in: users } } });
  await prisma.recipe.deleteMany({ where: { authorId: { in: users } } });
  await prisma.mediaAsset.deleteMany({ where: { ownerId: { in: users } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

test('admin content dashboard hides, restores and bulk moderates every resource type', async () => {
  const author = await createUser('author');
  const member = await createUser('member');
  const admin = await createUser('admin');
  await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
  const recipe = await createPublishedRecipe(author, `Công thức quản trị ${suffix}`);
  const comment = await createComment(member, recipe, `Bình luận quản trị ${suffix}`);
  const secondComment = await createComment(member, recipe, `Bình luận thứ hai ${suffix}`);
  const cooksnap = await createCooksnap(member, recipe);

  const denied = await request(app).get('/api/v1/admin/content').query({ type: 'recipes' }).set('Authorization', `Bearer ${member.token}`);
  assert.equal(denied.status, 403);

  const listing = await request(app).get('/api/v1/admin/content').query({ type: 'recipes', q: suffix }).set('Authorization', `Bearer ${admin.token}`);
  assert.equal(listing.status, 200);
  assert.equal(listing.body.data.some((item) => item.id === recipe.id), true);
  assert.equal(listing.body.meta.type, 'recipes');

  const hidden = await request(app).post(`/api/v1/admin/content/recipes/${recipe.id}/action`).set('Authorization', `Bearer ${admin.token}`).send({ action: 'HIDE', note: 'Ảnh không phù hợp.' });
  assert.equal(hidden.status, 200);
  assert.equal(hidden.body.data.changed, true);
  assert.ok(hidden.body.data.item.hiddenAt);
  const publicList = await request(app).get('/api/v1/recipes').query({ q: suffix });
  assert.equal(publicList.body.data.some((item) => item.id === recipe.id), false);
  const authorNotifications = await request(app).get('/api/v1/me/notifications').set('Authorization', `Bearer ${author.token}`);
  assert.equal(authorNotifications.body.data.some((item) => item.type === 'CONTENT_HIDE'), true);

  const restored = await request(app).post(`/api/v1/admin/content/recipes/${recipe.id}/action`).set('Authorization', `Bearer ${admin.token}`).send({ action: 'RESTORE' });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.data.item.hiddenAt, null);

  const bulkHide = await request(app).post('/api/v1/admin/content/bulk').set('Authorization', `Bearer ${admin.token}`).send({ type: 'comments', ids: [comment.id, secondComment.id], action: 'HIDE', note: 'Spam.' });
  assert.equal(bulkHide.status, 200);
  assert.equal(bulkHide.body.data.changed, 2);
  const hiddenComments = await prisma.comment.findMany({ where: { id: { in: [comment.id, secondComment.id] } }, select: { status: true, deletedAt: true } });
  assert.equal(hiddenComments.every((item) => item.status === 'HIDDEN' && item.deletedAt === null), true);

  const bulkRestore = await request(app).post('/api/v1/admin/content/bulk').set('Authorization', `Bearer ${admin.token}`).send({ type: 'comments', ids: [comment.id, secondComment.id], action: 'RESTORE' });
  assert.equal(bulkRestore.status, 200);
  assert.equal(bulkRestore.body.data.changed, 2);
  const activeComments = await prisma.comment.findMany({ where: { id: { in: [comment.id, secondComment.id] } }, select: { status: true, deletedAt: true } });
  assert.equal(activeComments.every((item) => item.status === 'ACTIVE' && item.deletedAt === null), true);

  const deletedComment = await request(app).post(`/api/v1/admin/content/comments/${secondComment.id}/action`).set('Authorization', `Bearer ${admin.token}`).send({ action: 'DELETE', note: 'Spam lặp lại.' });
  assert.equal(deletedComment.status, 200);
  const softDeletedComment = await prisma.comment.findUnique({ where: { id: secondComment.id }, select: { status: true, deletedAt: true } });
  assert.equal(softDeletedComment.status, 'DELETED');
  assert.ok(softDeletedComment.deletedAt);
  const restoreDeletedComment = await request(app).post(`/api/v1/admin/content/comments/${secondComment.id}/action`).set('Authorization', `Bearer ${admin.token}`).send({ action: 'RESTORE' });
  assert.equal(restoreDeletedComment.status, 200);
  const revivedComment = await prisma.comment.findUnique({ where: { id: secondComment.id }, select: { status: true, deletedAt: true } });
  assert.equal(revivedComment.status, 'ACTIVE');
  assert.equal(revivedComment.deletedAt, null);

  const hideCooksnap = await request(app).post(`/api/v1/admin/content/cooksnaps/${cooksnap.id}/action`).set('Authorization', `Bearer ${admin.token}`).send({ action: 'HIDE' });
  assert.equal(hideCooksnap.status, 200);
  let counters = await prisma.recipe.findUnique({ where: { id: recipe.id }, select: { cookSnapCount: true } });
  assert.equal(counters.cookSnapCount, 0);
  const restoreCooksnap = await request(app).post(`/api/v1/admin/content/cooksnaps/${cooksnap.id}/action`).set('Authorization', `Bearer ${admin.token}`).send({ action: 'RESTORE' });
  assert.equal(restoreCooksnap.status, 200);
  counters = await prisma.recipe.findUnique({ where: { id: recipe.id }, select: { cookSnapCount: true } });
  assert.equal(counters.cookSnapCount, 1);
  const deleteCooksnap = await request(app).post(`/api/v1/admin/content/cooksnaps/${cooksnap.id}/action`).set('Authorization', `Bearer ${admin.token}`).send({ action: 'DELETE' });
  assert.equal(deleteCooksnap.status, 200);
  counters = await prisma.recipe.findUnique({ where: { id: recipe.id }, select: { cookSnapCount: true } });
  assert.equal(counters.cookSnapCount, 0);

  const deletedRecipe = await request(app).post(`/api/v1/admin/content/recipes/${recipe.id}/action`).set('Authorization', `Bearer ${admin.token}`).send({ action: 'DELETE', note: 'Vi phạm quy tắc.' });
  assert.equal(deletedRecipe.status, 200);
  assert.ok(deletedRecipe.body.data.item.deletedAt);
  const archived = await prisma.recipe.findUnique({ where: { id: recipe.id }, select: { status: true, visibility: true } });
  assert.equal(archived.status, 'ARCHIVED');
  assert.equal(archived.visibility, 'PRIVATE');
  const restoredRecipe = await request(app).post(`/api/v1/admin/content/recipes/${recipe.id}/action`).set('Authorization', `Bearer ${admin.token}`).send({ action: 'RESTORE' });
  assert.equal(restoredRecipe.status, 200);
  const draft = await prisma.recipe.findUnique({ where: { id: recipe.id }, select: { status: true, visibility: true, deletedAt: true } });
  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.visibility, 'PRIVATE');
  assert.equal(draft.deletedAt, null);

  const invalidType = await request(app).get('/api/v1/admin/content').query({ type: 'users' }).set('Authorization', `Bearer ${admin.token}`);
  assert.equal(invalidType.status, 422);
  const emptyBulk = await request(app).post('/api/v1/admin/content/bulk').set('Authorization', `Bearer ${admin.token}`).send({ type: 'comments', ids: [], action: 'HIDE' });
  assert.equal(emptyBulk.status, 422);

  const audit = await request(app).get('/api/v1/admin/audit-logs').set('Authorization', `Bearer ${admin.token}`);
  assert.equal(audit.body.data.some((log) => log.action === 'CONTENT_HIDE' && log.targetId === recipe.id), true);
});

test('moderator can warn and temporarily suspend a member with audit trail', async () => {
  const member = await createUser('suspendmember');
  const moderator = await createUser('suspendmod');
  const admin = await createUser('suspendadmin');
  await prisma.user.update({ where: { id: moderator.id }, data: { role: 'MODERATOR' } });
  await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });

  const warned = await request(app).post(`/api/v1/moderation/users/${member.id}/warn`).set('Authorization', `Bearer ${moderator.token}`).send({ message: 'Vui lòng chỉnh sửa nội dung.' });
  assert.equal(warned.status, 201);
  const notifications = await request(app).get('/api/v1/me/notifications').set('Authorization', `Bearer ${member.token}`);
  assert.equal(notifications.body.data.some((item) => item.type === 'MODERATION_WARNING'), true);

  const invalidReason = await request(app).post(`/api/v1/moderation/users/${member.id}/suspend`).set('Authorization', `Bearer ${moderator.token}`).send({ durationDays: 7, reason: 'x' });
  assert.equal(invalidReason.status, 422);
  const tooLong = await request(app).post(`/api/v1/moderation/users/${member.id}/suspend`).set('Authorization', `Bearer ${moderator.token}`).send({ durationDays: 90, reason: 'Vi phạm nhiều lần.' });
  assert.equal(tooLong.status, 422);

  const suspended = await request(app).post(`/api/v1/moderation/users/${member.id}/suspend`).set('Authorization', `Bearer ${moderator.token}`).send({ durationDays: 7, reason: 'Vi phạm quy tắc cộng đồng.' });
  assert.equal(suspended.status, 200);
  assert.equal(suspended.body.data.user.status, 'SUSPENDED');
  assert.ok(suspended.body.data.user.suspendedUntil);
  const existingSession = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${member.token}`);
  assert.equal(existingSession.status, 401);
  const login = await request(app).post('/api/v1/auth/login').send({ identifier: member.username, password: 'correct horse battery staple' });
  assert.equal(login.status, 401);

  const privilegeEscalation = await request(app).post(`/api/v1/moderation/users/${admin.id}/suspend`).set('Authorization', `Bearer ${moderator.token}`).send({ durationDays: 7, reason: 'Không được phép.' });
  assert.equal(privilegeEscalation.status, 403);

  await prisma.user.update({ where: { id: member.id }, data: { suspendedUntil: new Date(Date.now() - 1000) } });
  const afterExpiry = await request(app).post('/api/v1/auth/login').send({ identifier: member.username, password: 'correct horse battery staple' });
  assert.equal(afterExpiry.status, 200);
  assert.equal(afterExpiry.body.data.user.status, 'ACTIVE');
  const restored = await prisma.user.findUnique({ where: { id: member.id }, select: { status: true, suspendedUntil: true, suspensionReason: true } });
  assert.equal(restored.status, 'ACTIVE');
  assert.equal(restored.suspendedUntil, null);
  assert.equal(restored.suspensionReason, null);

  const audit = await request(app).get('/api/v1/admin/audit-logs').set('Authorization', `Bearer ${admin.token}`);
  assert.equal(audit.body.data.some((log) => log.action === 'USER_SUSPENDED' && log.targetId === member.id), true);
});
