import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const suffix = Date.now().toString().slice(-8);
const users = [];

async function createUser(label, role = 'USER') {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: `reply-${label}-${suffix}@example.com`,
    username: `reply_${label.slice(0, 10)}_${suffix}`,
    password: 'correct horse battery staple',
    displayName: `Reply ${label}`,
  });
  assert.equal(response.status, 201);
  const user = { id: response.body.data.user.id, username: response.body.data.user.username, token: response.body.data.accessToken };
  if (role !== 'USER') await prisma.user.update({ where: { id: user.id }, data: { role } });
  users.push(user);
  return user;
}

async function createPublishedRecipe(author, title) {
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({
    title,
    ingredients: [{ displayName: 'Rau cải' }],
    steps: [{ instruction: 'Nấu chín.' }],
  });
  assert.equal(created.status, 201);
  const recipe = created.body.data.recipe;
  await prisma.recipe.update({ where: { id: recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
  return recipe;
}

after(async () => {
  const ids = users.map((user) => user.id);
  await prisma.comment.deleteMany({ where: { OR: [{ authorId: { in: ids } }, { recipe: { authorId: { in: ids } } }] } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.recipe.deleteMany({ where: { authorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

test('members can reply to comments and replies are nested in the list', async () => {
  const author = await createUser('author');
  const member = await createUser('member');
  const responder = await createUser('responder');
  const recipe = await createPublishedRecipe(author, 'Món có phản hồi');

  const parent = await request(app).post(`/api/v1/recipes/${recipe.id}/comments`).set('Authorization', `Bearer ${member.token}`).send({ content: 'Món này cần bao nhiêu nước?' });
  assert.equal(parent.status, 201);
  assert.equal(parent.body.data.comment.parentId, null);

  const reply = await request(app).post(`/api/v1/recipes/${recipe.id}/comments`).set('Authorization', `Bearer ${responder.token}`).send({ content: 'Khoảng 200ml nhé.', parentId: parent.body.data.comment.id });
  assert.equal(reply.status, 201);
  assert.equal(reply.body.data.comment.parentId, parent.body.data.comment.id);

  const list = await request(app).get(`/api/v1/recipes/${recipe.id}/comments`);
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 1);
  assert.equal(list.body.data[0].id, parent.body.data.comment.id);
  assert.equal(list.body.data[0].replies.length, 1);
  assert.equal(list.body.data[0].replies[0].id, reply.body.data.comment.id);

  const parentNotifications = await request(app).get('/api/v1/me/notifications').set('Authorization', `Bearer ${member.token}`);
  const replyNotice = parentNotifications.body.data.find((item) => item.type === 'COMMENT_REPLY');
  assert.ok(replyNotice);
  assert.equal(replyNotice.actionUrl, `/cong-thuc/${recipe.slug}#binh-luan-${reply.body.data.comment.id}`);

  const authorNotifications = await request(app).get('/api/v1/me/notifications').set('Authorization', `Bearer ${author.token}`);
  assert.equal(authorNotifications.body.data.filter((item) => item.type === 'RECIPE_COMMENT').length, 2);
  assert.equal(authorNotifications.body.data.filter((item) => item.type === 'COMMENT_REPLY').length, 0);
});

test('reply depth, parent ownership and parent validation are enforced', async () => {
  const author = await createUser('depth_author');
  const member = await createUser('depth_member');
  const recipe = await createPublishedRecipe(author, 'Món kiểm tra phản hồi');
  const otherRecipe = await createPublishedRecipe(author, 'Món khác');

  const parent = await request(app).post(`/api/v1/recipes/${recipe.id}/comments`).set('Authorization', `Bearer ${member.token}`).send({ content: 'Bình luận gốc.' });
  const reply = await request(app).post(`/api/v1/recipes/${recipe.id}/comments`).set('Authorization', `Bearer ${member.token}`).send({ content: 'Phản hồi cấp một.', parentId: parent.body.data.comment.id });

  const nested = await request(app).post(`/api/v1/recipes/${recipe.id}/comments`).set('Authorization', `Bearer ${member.token}`).send({ content: 'Phản hồi lồng nhau.', parentId: reply.body.data.comment.id });
  assert.equal(nested.status, 422);
  assert.equal(nested.body.error.code, 'COMMENT_REPLY_DEPTH_NOT_SUPPORTED');

  const foreignParent = await request(app).post(`/api/v1/recipes/${otherRecipe.id}/comments`).set('Authorization', `Bearer ${member.token}`).send({ content: 'Sai công thức.', parentId: parent.body.data.comment.id });
  assert.equal(foreignParent.status, 404);
  assert.equal(foreignParent.body.error.code, 'COMMENT_PARENT_NOT_FOUND');

  const invalidParent = await request(app).post(`/api/v1/recipes/${recipe.id}/comments`).set('Authorization', `Bearer ${member.token}`).send({ content: 'Sai định dạng.', parentId: 'not-a-uuid' });
  assert.equal(invalidParent.status, 422);
  assert.equal(invalidParent.body.error.code, 'VALIDATION_ERROR');
});

test('deleting a parent comment removes its replies from the public thread', async () => {
  const author = await createUser('delete_author');
  const member = await createUser('delete_member');
  const responder = await createUser('delete_responder');
  const recipe = await createPublishedRecipe(author, 'Món xóa bình luận');

  const parent = await request(app).post(`/api/v1/recipes/${recipe.id}/comments`).set('Authorization', `Bearer ${member.token}`).send({ content: 'Bình luận sẽ bị xóa.' });
  const reply = await request(app).post(`/api/v1/recipes/${recipe.id}/comments`).set('Authorization', `Bearer ${responder.token}`).send({ content: 'Phản hồi đi kèm.', parentId: parent.body.data.comment.id });

  const removed = await request(app).delete(`/api/v1/comments/${parent.body.data.comment.id}`).set('Authorization', `Bearer ${member.token}`);
  assert.equal(removed.status, 204);

  const list = await request(app).get(`/api/v1/recipes/${recipe.id}/comments`);
  assert.equal(list.body.data.length, 0);

  const storedReply = await prisma.comment.findUnique({ where: { id: reply.body.data.comment.id } });
  assert.equal(storedReply.status, 'DELETED');
  assert.ok(storedReply.deletedAt);
});

test('moderators hide comments without marking them as deleted', async () => {
  const author = await createUser('hide_author');
  const member = await createUser('hide_member');
  const moderator = await createUser('hide_moderator', 'MODERATOR');
  const recipe = await createPublishedRecipe(author, 'Món bị ẩn bình luận');

  const comment = await request(app).post(`/api/v1/recipes/${recipe.id}/comments`).set('Authorization', `Bearer ${member.token}`).send({ content: 'Nội dung bị báo cáo.' });
  const hidden = await request(app).delete(`/api/v1/comments/${comment.body.data.comment.id}`).set('Authorization', `Bearer ${moderator.token}`);
  assert.equal(hidden.status, 204);

  const stored = await prisma.comment.findUnique({ where: { id: comment.body.data.comment.id } });
  assert.equal(stored.status, 'HIDDEN');
  assert.equal(stored.deletedAt, null);

  const list = await request(app).get(`/api/v1/recipes/${recipe.id}/comments`);
  assert.equal(list.body.data.length, 0);
});
