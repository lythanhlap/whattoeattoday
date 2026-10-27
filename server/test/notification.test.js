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
    email: `notification-${label}-${suffix}@example.com`,
    username: `notification_${label}_${suffix}`,
    password: 'correct horse battery staple',
    displayName: `Notification ${label}`,
  });
  assert.equal(response.status, 201);
  users.push({ id: response.body.data.user.id, username: response.body.data.user.username });
  return { id: response.body.data.user.id, username: response.body.data.user.username, token: response.body.data.accessToken };
}

after(async () => {
  const ids = users.map((user) => user.id);
  await prisma.follow.deleteMany({ where: { OR: [{ followerId: { in: ids } }, { followingId: { in: ids } }] } });
  await prisma.comment.deleteMany({ where: { OR: [{ authorId: { in: ids } }, { recipe: { authorId: { in: ids } } }] } });
  await prisma.cooksnap.deleteMany({ where: { OR: [{ authorId: { in: ids } }, { recipe: { authorId: { in: ids } } }] } });
  await prisma.recipe.deleteMany({ where: { authorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

test('community activity notifies the recipe author with a destination link', async () => {
  const author = await createUser('author');
  const member = await createUser('member');
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({
    title: 'Món nhận thông báo',
    ingredients: [{ displayName: 'Rau' }],
    steps: [{ instruction: 'Nấu chín.' }],
  });
  assert.equal(created.status, 201);
  const recipe = created.body.data.recipe;
  await prisma.recipe.update({ where: { id: recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });

  const comment = await request(app).post(`/api/v1/recipes/${recipe.id}/comments`).set('Authorization', `Bearer ${member.token}`).send({ content: 'Món này rất dễ làm.' });
  assert.equal(comment.status, 201);

  const afterComment = await request(app).get('/api/v1/me/notifications').set('Authorization', `Bearer ${author.token}`);
  assert.equal(afterComment.status, 200);
  const commentNotice = afterComment.body.data.find((item) => item.type === 'RECIPE_COMMENT');
  assert.ok(commentNotice);
  assert.equal(commentNotice.actionUrl, `/cong-thuc/${recipe.slug}`);
  assert.match(commentNotice.message, /Notification member/);
  assert.equal(afterComment.body.meta.unread, 1);

  const cooksnap = await request(app).post(`/api/v1/recipes/${recipe.id}/cooksnaps`).set('Authorization', `Bearer ${member.token}`).send({ imageUrl: 'https://storage.example/notification-snap.jpg' });
  assert.equal(cooksnap.status, 201);

  const afterCooksnap = await request(app).get('/api/v1/me/notifications').set('Authorization', `Bearer ${author.token}`);
  const cooksnapNotice = afterCooksnap.body.data.find((item) => item.type === 'RECIPE_COOKSNAP');
  assert.ok(cooksnapNotice);
  assert.equal(cooksnapNotice.actionUrl, `/cong-thuc/${recipe.slug}`);
  assert.equal(afterCooksnap.body.meta.unread, 2);

  await request(app).post(`/api/v1/recipes/${recipe.id}/comments`).set('Authorization', `Bearer ${author.token}`).send({ content: 'Cảm ơn bạn.' });
  const afterSelfComment = await request(app).get('/api/v1/me/notifications').set('Authorization', `Bearer ${author.token}`);
  assert.equal(afterSelfComment.body.meta.total, 2);

  const memberNotifications = await request(app).get('/api/v1/me/notifications').set('Authorization', `Bearer ${member.token}`);
  assert.equal(memberNotifications.body.meta.total, 0);

  const followed = await request(app).post(`/api/v1/users/${author.id}/follow`).set('Authorization', `Bearer ${member.token}`);
  assert.equal(followed.status, 204);
  const duplicateFollow = await request(app).post(`/api/v1/users/${author.id}/follow`).set('Authorization', `Bearer ${member.token}`);
  assert.equal(duplicateFollow.status, 204);

  const afterFollow = await request(app).get('/api/v1/me/notifications').set('Authorization', `Bearer ${author.token}`);
  const followNotices = afterFollow.body.data.filter((item) => item.type === 'NEW_FOLLOWER');
  assert.equal(followNotices.length, 1);
  assert.equal(followNotices[0].actionUrl, `/nguoi-dung/${member.username}`);

  const marked = await request(app).patch(`/api/v1/me/notifications/${commentNotice.id}/read`).set('Authorization', `Bearer ${author.token}`);
  assert.equal(marked.status, 204);
  const afterRead = await request(app).get('/api/v1/me/notifications').set('Authorization', `Bearer ${author.token}`);
  assert.ok(afterRead.body.data.find((item) => item.id === commentNotice.id).readAt);
  assert.equal(afterRead.body.meta.unread, 2);

  const foreignRead = await request(app).patch(`/api/v1/me/notifications/${commentNotice.id}/read`).set('Authorization', `Bearer ${member.token}`);
  assert.equal(foreignRead.status, 404);
});
