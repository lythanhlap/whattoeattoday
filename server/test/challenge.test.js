import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const suffix = Date.now().toString().slice(-8);
const users = [];
const challenges = [];

async function createUser(label) {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: `challenge-${label}-${suffix}@example.com`,
    username: `challenge_${label}_${suffix}`,
    password: 'correct horse battery staple',
    displayName: `Challenge ${label}`,
  });
  assert.equal(response.status, 201);
  users.push(response.body.data.user.id);
  return { id: response.body.data.user.id, token: response.body.data.accessToken, username: response.body.data.user.username };
}

async function createPublicRecipe(user, title) {
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${user.token}`).send({
    title,
    description: 'Công thức dùng cho kiểm thử thử thách.',
    ingredients: [{ displayName: 'Nguyên liệu kiểm thử', quantity: '1' }],
    steps: [{ instruction: 'Thực hiện món kiểm thử.' }],
  });
  assert.equal(created.status, 201);
  return prisma.recipe.update({
    where: { id: created.body.data.recipe.id },
    data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() },
  });
}

function challengeDates({ active = true, ended = false } = {}) {
  const now = Date.now();
  if (ended) return { startsAt: new Date(now - 10 * 86400000), endsAt: new Date(now - 86400000) };
  if (active) return { startsAt: new Date(now - 86400000), endsAt: new Date(now + 10 * 86400000) };
  return { startsAt: new Date(now + 86400000), endsAt: new Date(now + 10 * 86400000) };
}

async function createChallenge(user, input) {
  const response = await request(app).post('/api/v1/challenges').set('Authorization', `Bearer ${user.token}`).send(input);
  assert.equal(response.status, 201);
  challenges.push(response.body.data.challenge.id);
  return response.body.data.challenge;
}

after(async () => {
  for (const id of users) {
    await prisma.challengeEntry.deleteMany({ where: { OR: [{ submittedById: id }, { challenge: { createdById: id } }, { recipe: { authorId: id } }] } });
    await prisma.challenge.deleteMany({ where: { createdById: id } });
    await prisma.auditLog.deleteMany({ where: { actorId: id } });
    await prisma.recipe.deleteMany({ where: { authorId: id } });
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

test('only editors and admins can create challenges and drafts stay private', async () => {
  const member = await createUser('member');
  const editor = await createUser('editor');
  await prisma.user.update({ where: { id: editor.id }, data: { role: 'EDITOR' } });

  const forbidden = await request(app).post('/api/v1/challenges').set('Authorization', `Bearer ${member.token}`).send({
    title: 'Thử thách không được phép',
    ...challengeDates(),
  });
  assert.equal(forbidden.status, 403);

  const draft = await createChallenge(editor, {
    title: 'Thử thách bản nháp',
    description: 'Chỉ editor thấy bản nháp.',
    ...challengeDates(),
    status: 'DRAFT',
  });
  assert.equal(draft.status, 'DRAFT');

  const publicList = await request(app).get('/api/v1/challenges');
  assert.equal(publicList.status, 200);
  assert.equal(publicList.body.data.some((challenge) => challenge.id === draft.id), false);

  const guestDetail = await request(app).get(`/api/v1/challenges/${draft.id}`);
  assert.equal(guestDetail.status, 404);

  const editorDetail = await request(app).get(`/api/v1/challenges/${draft.id}`).set('Authorization', `Bearer ${editor.token}`);
  assert.equal(editorDetail.status, 200);
  assert.equal(editorDetail.body.data.challenge.id, draft.id);
});

test('active challenge accepts one public recipe per member and blocks duplicates', async () => {
  const editor = await createUser('owner');
  await prisma.user.update({ where: { id: editor.id }, data: { role: 'EDITOR' } });
  const member = await createUser('submitter');
  const other = await createUser('other');
  const recipe = await createPublicRecipe(member, 'Món tham gia thử thách');
  const otherRecipe = await createPublicRecipe(other, 'Món của người khác');

  const challenge = await createChallenge(editor, {
    title: 'Thử thách món chay tuần này',
    description: 'Gửi món chay của bạn.',
    ...challengeDates({ active: true }),
    status: 'ACTIVE',
  });
  assert.equal(challenge.status, 'ACTIVE');

  const list = await request(app).get('/api/v1/challenges').query({ status: 'ACTIVE' });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.some((item) => item.id === challenge.id), true);

  const guestSubmit = await request(app).post(`/api/v1/challenges/${challenge.id}/entries`).send({ recipeId: recipe.id });
  assert.equal(guestSubmit.status, 401);

  const submitted = await request(app).post(`/api/v1/challenges/${challenge.id}/entries`).set('Authorization', `Bearer ${member.token}`).send({ recipeId: recipe.id });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.data.entry.recipe.id, recipe.id);

  const duplicate = await request(app).post(`/api/v1/challenges/${challenge.id}/entries`).set('Authorization', `Bearer ${member.token}`).send({ recipeId: recipe.id });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'CHALLENGE_ENTRY_DUPLICATE');

  const foreignRecipe = await request(app).post(`/api/v1/challenges/${challenge.id}/entries`).set('Authorization', `Bearer ${member.token}`).send({ recipeId: otherRecipe.id });
  assert.equal(foreignRecipe.status, 403);
  assert.equal(foreignRecipe.body.error.code, 'CHALLENGE_RECIPE_NOT_OWNED');

  const detail = await request(app).get(`/api/v1/challenges/${challenge.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.challenge.entryCount, 1);
  assert.equal(detail.body.data.challenge.entries.length, 1);
});

test('ended or draft challenges do not accept entries', async () => {
  const editor = await createUser('endeditor');
  await prisma.user.update({ where: { id: editor.id }, data: { role: 'EDITOR' } });
  const member = await createUser('endedmember');
  const recipe = await createPublicRecipe(member, 'Món cho thử thách đã kết thúc');

  const ended = await createChallenge(editor, {
    title: 'Thử thách đã kết thúc',
    ...challengeDates({ ended: true }),
    status: 'ACTIVE',
  });
  assert.equal(ended.status, 'ENDED');

  const rejected = await request(app).post(`/api/v1/challenges/${ended.id}/entries`).set('Authorization', `Bearer ${member.token}`).send({ recipeId: recipe.id });
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.error.code, 'CHALLENGE_NOT_ACTIVE');

  const draft = await createChallenge(editor, {
    title: 'Thử thách chưa công khai',
    ...challengeDates({ active: true }),
    status: 'DRAFT',
  });
  const draftRejected = await request(app).post(`/api/v1/challenges/${draft.id}/entries`).set('Authorization', `Bearer ${member.token}`).send({ recipeId: recipe.id });
  assert.equal(draftRejected.status, 404);
});

test('moderator can remove a challenge entry and removal is audited', async () => {
  const editor = await createUser('moreditor');
  await prisma.user.update({ where: { id: editor.id }, data: { role: 'EDITOR' } });
  const member = await createUser('moremember');
  const moderator = await createUser('moderator');
  await prisma.user.update({ where: { id: moderator.id }, data: { role: 'MODERATOR' } });
  const intruder = await createUser('intruder');
  await prisma.user.update({ where: { id: intruder.id }, data: { role: 'EDITOR' } });
  const recipe = await createPublicRecipe(member, 'Món bị gỡ khỏi thử thách');
  const challenge = await createChallenge(editor, {
    title: 'Thử thách kiểm tra moderation',
    ...challengeDates({ active: true }),
    status: 'ACTIVE',
  });

  const submitted = await request(app).post(`/api/v1/challenges/${challenge.id}/entries`).set('Authorization', `Bearer ${member.token}`).send({ recipeId: recipe.id });
  assert.equal(submitted.status, 201);
  const entryId = submitted.body.data.entry.id;

  const forbidden = await request(app).delete(`/api/v1/challenges/${challenge.id}/entries/${entryId}`).set('Authorization', `Bearer ${intruder.token}`);
  assert.equal(forbidden.status, 403);

  const removed = await request(app).delete(`/api/v1/challenges/${challenge.id}/entries/${entryId}`).set('Authorization', `Bearer ${moderator.token}`);
  assert.equal(removed.status, 204);

  const detail = await request(app).get(`/api/v1/challenges/${challenge.id}`);
  assert.equal(detail.body.data.challenge.entryCount, 0);
  assert.equal(detail.body.data.challenge.entries.length, 0);

  const auditLog = await prisma.auditLog.findFirst({ where: { actorId: moderator.id, action: 'CHALLENGE_ENTRY_REMOVED', targetId: entryId } });
  assert.ok(auditLog);
});

test('recipe views are counted once per viewer per day and private recipes are hidden', async () => {
  const author = await createUser('viewauthor');
  const viewer = await createUser('viewer');
  const recipe = await createPublicRecipe(author, 'Món kiểm tra lượt xem');

  const firstView = await request(app).post(`/api/v1/recipes/${recipe.id}/view`).set('Authorization', `Bearer ${viewer.token}`);
  assert.equal(firstView.status, 200);
  assert.equal(firstView.body.data.recorded, true);
  assert.equal(firstView.body.data.viewCount, 1);

  const secondView = await request(app).post(`/api/v1/recipes/${recipe.id}/view`).set('Authorization', `Bearer ${viewer.token}`);
  assert.equal(secondView.status, 200);
  assert.equal(secondView.body.data.recorded, false);
  assert.equal(secondView.body.data.viewCount, 1);

  const otherViewer = await createUser('viewer2');
  const thirdView = await request(app).post(`/api/v1/recipes/${recipe.id}/view`).set('Authorization', `Bearer ${otherViewer.token}`);
  assert.equal(thirdView.body.data.recorded, true);
  assert.equal(thirdView.body.data.viewCount, 2);

  const privateRecipe = await prisma.recipe.create({
    data: { authorId: author.id, title: 'Công thức riêng tư', slug: `private-view-${suffix}`, status: 'DRAFT', visibility: 'PRIVATE' },
  });
  const hidden = await request(app).post(`/api/v1/recipes/${privateRecipe.id}/view`);
  assert.equal(hidden.status, 404);
});
