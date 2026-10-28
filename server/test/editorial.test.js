import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const suffix = Date.now().toString().slice(-8);
const users = [];
const recipeIds = [];
const assetIds = [];

async function createUser(label) {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: `editorial-${label}-${suffix}@example.com`,
    username: `ed_${label}_${suffix}`,
    password: 'correct horse battery staple',
    displayName: `Editorial ${label}`,
  });
  assert.equal(response.status, 201);
  users.push(response.body.data.user.id);
  return { id: response.body.data.user.id, username: response.body.data.user.username, token: response.body.data.accessToken };
}

async function createMediaAsset(ownerId, label) {
  const asset = await prisma.mediaAsset.create({
    data: {
      ownerId,
      providerPublicId: `test/${ownerId}/${label}-${suffix}`,
      secureUrl: `https://res.cloudinary.com/demo/image/upload/${label}-${suffix}.jpg`,
      format: 'jpg',
      bytes: 2048,
    },
  });
  assetIds.push(asset.id);
  return asset;
}

async function createRecipe(user, title, extra = {}) {
  const response = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${user.token}`).send({
    title,
    visibility: 'PUBLIC',
    ingredients: [{ displayName: 'Nguyên liệu bí mật', quantity: '1', unit: 'phần' }],
    steps: [{ instruction: 'Nấu chín rồi thưởng thức.' }],
    ...extra,
  });
  assert.equal(response.status, 201);
  recipeIds.push(response.body.data.recipe.id);
  return response.body.data.recipe;
}

async function submitForReview(user, recipe) {
  const cover = await createMediaAsset(user.id, `cover-${recipe.id.slice(0, 8)}`);
  const patched = await request(app).patch(`/api/v1/recipes/${recipe.id}`).set('Authorization', `Bearer ${user.token}`).send({ coverImageId: cover.id });
  assert.equal(patched.status, 200);
  const published = await request(app).post(`/api/v1/recipes/${recipe.id}/publish`).set('Authorization', `Bearer ${user.token}`);
  assert.equal(published.status, 200);
  assert.equal(published.body.data.recipe.status, 'PENDING_REVIEW');
  return published.body.data.recipe;
}

after(async () => {
  await prisma.notification.deleteMany({ where: { userId: { in: users } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
  await prisma.report.deleteMany({ where: { reporterId: { in: users } } });
  await prisma.comment.deleteMany({ where: { authorId: { in: users } } });
  await prisma.cooksnap.deleteMany({ where: { authorId: { in: users } } });
  await prisma.bookmark.deleteMany({ where: { userId: { in: users } } });
  await prisma.collection.deleteMany({ where: { ownerId: { in: users } } });
  await prisma.follow.deleteMany({ where: { OR: [{ followerId: { in: users } }, { followingId: { in: users } }] } });
  await prisma.challengeEntry.deleteMany({ where: { submittedById: { in: users } } });
  await prisma.recipe.deleteMany({ where: { authorId: { in: users } } });
  await prisma.mediaAsset.deleteMany({ where: { ownerId: { in: users } } });
  // Taxonomy rows created with the per-run suffix must not leak into the dev database
  // when an assertion fails before the test's own cleanup runs.
  const runCategories = await prisma.category.findMany({ where: { slug: { endsWith: suffix } }, select: { id: true } });
  const runTags = await prisma.tag.findMany({ where: { slug: { endsWith: suffix } }, select: { id: true } });
  await prisma.category.deleteMany({ where: { id: { in: runCategories.map((item) => item.id) } } });
  await prisma.tag.deleteMany({ where: { id: { in: runTags.map((item) => item.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

test('editor review queue approves a pending recipe and notifies the author', async () => {
  const member = await createUser('member');
  const editor = await createUser('editor');
  const admin = await createUser('admin');
  await prisma.user.update({ where: { id: editor.id }, data: { role: 'EDITOR' } });
  await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });

  const recipe = await createRecipe(member, `Công thức chờ duyệt ${suffix}`);
  await submitForReview(member, recipe);

  const forbiddenQueue = await request(app).get('/api/v1/moderation/review-queue').set('Authorization', `Bearer ${member.token}`);
  assert.equal(forbiddenQueue.status, 403);

  const queue = await request(app).get('/api/v1/moderation/review-queue').set('Authorization', `Bearer ${editor.token}`);
  assert.equal(queue.status, 200);
  assert.equal(queue.body.data.some((item) => item.id === recipe.id), true);

  const approved = await request(app).post(`/api/v1/moderation/recipes/${recipe.id}/review`).set('Authorization', `Bearer ${editor.token}`).send({ action: 'APPROVE' });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.recipe.status, 'PUBLISHED');
  assert.ok(approved.body.data.recipe.publishedAt);

  const publicList = await request(app).get('/api/v1/recipes').query({ q: `chờ duyệt ${suffix}` });
  assert.equal(publicList.body.data.some((item) => item.id === recipe.id), true);

  const notifications = await request(app).get('/api/v1/me/notifications').set('Authorization', `Bearer ${member.token}`);
  assert.equal(notifications.body.data.some((item) => item.type === 'RECIPE_APPROVED'), true);

  const audit = await request(app).get('/api/v1/admin/audit-logs').set('Authorization', `Bearer ${admin.token}`);
  assert.equal(audit.body.data.some((log) => log.action === 'RECIPE_APPROVED' && log.targetId === recipe.id), true);

  const editorEdit = await request(app).patch(`/api/v1/recipes/${recipe.id}`).set('Authorization', `Bearer ${editor.token}`).send({ description: 'Biên tập viên cập nhật mô tả.' });
  assert.equal(editorEdit.status, 200);
  assert.equal(editorEdit.body.data.recipe.status, 'PUBLISHED');

  const invalidAction = await request(app).post(`/api/v1/moderation/recipes/${recipe.id}/review`).set('Authorization', `Bearer ${editor.token}`).send({ action: 'PUBLISH_NOW' });
  assert.equal(invalidAction.status, 422);

  const alreadyReviewed = await request(app).post(`/api/v1/moderation/recipes/${recipe.id}/review`).set('Authorization', `Bearer ${editor.token}`).send({ action: 'APPROVE' });
  assert.equal(alreadyReviewed.status, 409);
  assert.equal(alreadyReviewed.body.error.code, 'RECIPE_REVIEW_INVALID_STATE');

  const authorEdit = await request(app).patch(`/api/v1/recipes/${recipe.id}`).set('Authorization', `Bearer ${member.token}`).send({ description: 'Tác giả cập nhật mô tả.' });
  assert.equal(authorEdit.status, 200);
  assert.equal(authorEdit.body.data.recipe.status, 'PENDING_REVIEW');
});

test('editor can reject with a note and request changes with a mandatory note', async () => {
  const member = await createUser('rejectmember');
  const editor = await createUser('rejecteditor');
  await prisma.user.update({ where: { id: editor.id }, data: { role: 'EDITOR' } });

  const recipe = await createRecipe(member, `Công thức bị trả lại ${suffix}`);
  await submitForReview(member, recipe);

  const missingNote = await request(app).post(`/api/v1/moderation/recipes/${recipe.id}/review`).set('Authorization', `Bearer ${editor.token}`).send({ action: 'REJECT' });
  assert.equal(missingNote.status, 422);

  const rejected = await request(app).post(`/api/v1/moderation/recipes/${recipe.id}/review`).set('Authorization', `Bearer ${editor.token}`).send({ action: 'REJECT', note: 'Thiếu ảnh minh họa rõ ràng.' });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.data.recipe.status, 'REJECTED');
  assert.equal(rejected.body.data.recipe.reviewNote, 'Thiếu ảnh minh họa rõ ràng.');

  const memberNotifications = await request(app).get('/api/v1/me/notifications').set('Authorization', `Bearer ${member.token}`);
  assert.equal(memberNotifications.body.data.some((item) => item.type === 'RECIPE_REJECTED'), true);

  const resubmitted = await request(app).post(`/api/v1/recipes/${recipe.id}/publish`).set('Authorization', `Bearer ${member.token}`);
  assert.equal(resubmitted.status, 200);
  assert.equal(resubmitted.body.data.recipe.status, 'PENDING_REVIEW');

  const changes = await request(app).post(`/api/v1/moderation/recipes/${recipe.id}/review`).set('Authorization', `Bearer ${editor.token}`).send({ action: 'REQUEST_CHANGES', note: 'Vui lòng bổ sung mẹo bảo quản.' });
  assert.equal(changes.status, 200);
  assert.equal(changes.body.data.recipe.status, 'DRAFT');
  assert.equal(changes.body.data.recipe.visibility, 'PRIVATE');
});

test('cover image must be an owned media asset', async () => {
  const owner = await createUser('coverowner');
  const other = await createUser('coverother');
  const recipe = await createRecipe(owner, `Công thức kiểm tra ảnh ${suffix}`);
  const otherAsset = await createMediaAsset(other.id, `foreign-${recipe.id.slice(0, 8)}`);

  const invalid = await request(app).patch(`/api/v1/recipes/${recipe.id}`).set('Authorization', `Bearer ${owner.token}`).send({ coverImageId: '00000000-0000-4000-8000-000000000001' });
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.error.code, 'RECIPE_COVER_INVALID');

  const foreign = await request(app).patch(`/api/v1/recipes/${recipe.id}`).set('Authorization', `Bearer ${owner.token}`).send({ coverImageId: otherAsset.id });
  assert.equal(foreign.status, 422);

  const ownAsset = await createMediaAsset(owner.id, `own-${recipe.id.slice(0, 8)}`);
  const accepted = await request(app).patch(`/api/v1/recipes/${recipe.id}`).set('Authorization', `Bearer ${owner.token}`).send({ coverImageId: ownAsset.id });
  assert.equal(accepted.status, 200);
  assert.ok(accepted.body.data.recipe.coverImage?.secureUrl);
});

test('editors manage taxonomy and feature recipes while members are denied', async () => {
  const member = await createUser('taxmember');
  const editor = await createUser('taxeditor');
  await prisma.user.update({ where: { id: editor.id }, data: { role: 'EDITOR' } });
  const recipe = await createRecipe(member, `Công thức nổi bật ${suffix}`);

  const denied = await request(app).post('/api/v1/categories').set('Authorization', `Bearer ${member.token}`).send({ name: 'Không được tạo' });
  assert.equal(denied.status, 403);

  const category = await request(app).post('/api/v1/categories').set('Authorization', `Bearer ${editor.token}`).send({ name: `Món nướng ${suffix}`, description: 'Món nướng tại nhà.' });
  assert.equal(category.status, 201);
  assert.match(category.body.data.category.slug, /^mon-nuong/);

  const duplicate = await request(app).post('/api/v1/categories').set('Authorization', `Bearer ${editor.token}`).send({ name: `Món nướng ${suffix}` });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'TAXONOMY_CONFLICT');

  const updated = await request(app).patch(`/api/v1/categories/${category.body.data.category.id}`).set('Authorization', `Bearer ${editor.token}`).send({ description: 'Món nướng cuối tuần.' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.category.description, 'Món nướng cuối tuần.');

  const tag = await request(app).post('/api/v1/tags').set('Authorization', `Bearer ${editor.token}`).send({ name: `Nhanh gọn ${suffix}` });
  assert.equal(tag.status, 201);
  const removedTag = await request(app).delete(`/api/v1/tags/${tag.body.data.tag.id}`).set('Authorization', `Bearer ${editor.token}`);
  assert.equal(removedTag.status, 204);

  const memberFeature = await request(app).patch(`/api/v1/moderation/recipes/${recipe.id}/featured`).set('Authorization', `Bearer ${member.token}`).send({ featured: true });
  assert.equal(memberFeature.status, 403);

  const featured = await request(app).patch(`/api/v1/moderation/recipes/${recipe.id}/featured`).set('Authorization', `Bearer ${editor.token}`).send({ featured: true });
  assert.equal(featured.status, 200);
  assert.ok(featured.body.data.recipe.featuredAt);

  await prisma.recipe.update({ where: { id: recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
  const list = await request(app).get('/api/v1/recipes').query({ featured: 'true' });
  assert.equal(list.body.data.some((item) => item.id === recipe.id), true);

  const removedCategory = await request(app).delete(`/api/v1/categories/${category.body.data.category.id}`).set('Authorization', `Bearer ${editor.token}`);
  assert.equal(removedCategory.status, 204);
});

test('search supports Vietnamese diet tags, ingredient filters and category keywords', async () => {
  const member = await createUser('searchmember');
  const editor = await createUser('searcheditor');
  await prisma.user.update({ where: { id: editor.id }, data: { role: 'EDITOR' } });

  const category = await prisma.category.create({ data: { name: `Bữa tối ${suffix}`, slug: `bua-toi-${suffix}` } });
  const tag = await prisma.tag.create({ data: { name: `Eat clean ${suffix}`, slug: `eat-clean-${suffix}` } });
  const recipe = await createRecipe(member, `Món eat clean ${suffix}`, { categoryId: category.id, tagIds: [tag.id] });
  await prisma.recipe.update({ where: { id: recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });

  // The diet filter only recognises the canonical tag slugs.
  const canonicalTag = await prisma.tag.upsert({ where: { slug: 'eat-clean' }, update: {}, create: { name: 'Eat clean', slug: 'eat-clean' } });
  await prisma.recipeTag.create({ data: { recipeId: recipe.id, tagId: canonicalTag.id } });
  const diet = await request(app).get('/api/v1/recipes').query({ diet: 'eat-clean', q: `eat clean ${suffix}` });
  assert.equal(diet.body.data.some((item) => item.id === recipe.id), true);

  const ingredient = await request(app).get('/api/v1/recipes').query({ ingredient: 'nguyen lieu bi mat' });
  assert.equal(ingredient.body.data.some((item) => item.id === recipe.id), true);

  const categorySearch = await request(app).get('/api/v1/recipes').query({ q: `Bữa tối ${suffix}` });
  assert.equal(categorySearch.body.data.some((item) => item.id === recipe.id), true);

  const invalidDiet = await request(app).get('/api/v1/recipes').query({ diet: 'keto' });
  assert.equal(invalidDiet.status, 422);

  const trending = await request(app).get('/api/v1/trending-keywords');
  assert.equal(trending.status, 200);
  assert.ok(Array.isArray(trending.body.data.keywords));

  await prisma.recipeTag.deleteMany({ where: { recipeId: recipe.id } });
  await prisma.recipe.delete({ where: { id: recipe.id } });
  await prisma.tag.delete({ where: { id: tag.id } });
  await prisma.category.delete({ where: { id: category.id } });
});

test('member updates profile, changes password and receives a sitemap entry', async () => {
  const member = await createUser('profilemember');
  const other = await createUser('profileother');

  const invalid = await request(app).patch('/api/v1/me/profile').set('Authorization', `Bearer ${member.token}`).send({ username: 'a b' });
  assert.equal(invalid.status, 422);

  const duplicate = await request(app).patch('/api/v1/me/profile').set('Authorization', `Bearer ${member.token}`).send({ username: other.username });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'USERNAME_ALREADY_EXISTS');

  const avatar = await createMediaAsset(member.id, 'avatar');
  const newUsername = `profile_${suffix}`;
  const updated = await request(app).patch('/api/v1/me/profile').set('Authorization', `Bearer ${member.token}`).send({
    displayName: 'Thành viên đã đổi tên',
    bio: 'Thích nấu món chay.',
    username: newUsername,
    avatarMediaId: avatar.id,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.user.username, newUsername);
  assert.equal(updated.body.data.user.profile.displayName, 'Thành viên đã đổi tên');
  assert.equal(updated.body.data.user.profile.avatarUrl, avatar.secureUrl);

  const guestUpdate = await request(app).patch('/api/v1/me/profile').send({ displayName: 'Không được' });
  assert.equal(guestUpdate.status, 401);

  const wrongPassword = await request(app).post('/api/v1/auth/change-password').set('Authorization', `Bearer ${member.token}`).send({ currentPassword: 'wrong-password', newPassword: 'a-new-password' });
  assert.equal(wrongPassword.status, 422);
  assert.equal(wrongPassword.body.error.code, 'PASSWORD_MISMATCH');

  const shortPassword = await request(app).post('/api/v1/auth/change-password').set('Authorization', `Bearer ${member.token}`).send({ currentPassword: 'correct horse battery staple', newPassword: 'short' });
  assert.equal(shortPassword.status, 422);

  const changed = await request(app).post('/api/v1/auth/change-password').set('Authorization', `Bearer ${member.token}`).send({ currentPassword: 'correct horse battery staple', newPassword: 'a-brand-new-password' });
  assert.equal(changed.status, 204);

  const oldLogin = await request(app).post('/api/v1/auth/login').send({ identifier: newUsername, password: 'correct horse battery staple' });
  assert.equal(oldLogin.status, 401);
  const newLogin = await request(app).post('/api/v1/auth/login').send({ identifier: newUsername, password: 'a-brand-new-password' });
  assert.equal(newLogin.status, 200);

  const recipe = await createRecipe(newLogin.body.data.user ? { ...member, token: newLogin.body.data.accessToken } : member, `Công thức sitemap ${suffix}`);
  await prisma.recipe.update({ where: { id: recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
  const sitemap = await request(app).get('/sitemap.xml');
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.text, new RegExp(recipe.slug));
  assert.match(sitemap.text, /<urlset/);
  const robots = await request(app).get('/robots.txt');
  assert.equal(robots.status, 200);
  assert.match(robots.text, /Sitemap:/);
  const sitemapPage = await request(app).get('/sitemap-1.xml');
  assert.equal(sitemapPage.status, 200);
  assert.match(sitemapPage.text, /<urlset/);
  const missingPage = await request(app).get('/sitemap-999.xml');
  assert.equal(missingPage.status, 404);
});
