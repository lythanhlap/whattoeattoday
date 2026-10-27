import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { cleanupOrphanMediaAssets, registerUploadedAsset } from '../src/services/mediaService.js';

const app = createApp();
const suffix = Date.now().toString().slice(-8);
const users = [];

async function createUser(label) {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: `recipe-${label}-${suffix}@example.com`,
    username: `recipe_${label}_${suffix}`,
    password: 'correct horse battery staple',
    displayName: `Recipe ${label}`,
  });
  assert.equal(response.status, 201);
  users.push(response.body.data.user.id);
  return { id: response.body.data.user.id, token: response.body.data.accessToken };
}

after(async () => {
  for (const id of users) {
    await prisma.follow.deleteMany({ where: { OR: [{ followerId: id }, { followingId: id }] } });
    await prisma.report.deleteMany({ where: { OR: [{ reporterId: id }, { recipe: { authorId: id } }, { resolvedBy: id }] } });
    await prisma.comment.deleteMany({ where: { OR: [{ authorId: id }, { recipe: { authorId: id } }] } });
    await prisma.auditLog.deleteMany({ where: { actorId: id } });
    await prisma.recipe.deleteMany({ where: { authorId: id } });
    await prisma.mediaAsset.deleteMany({ where: { ownerId: id } });
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

test('user can create a private draft and public listing excludes it', async () => {
  const user = await createUser('draft');
  const response = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${user.token}`).send({
    title: 'Canh rau draft',
    ingredients: [{ displayName: 'Rau xanh', quantity: '1', unit: 'bó' }],
    steps: [{ instruction: 'Rửa rau và nấu chín.' }],
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.recipe.status, 'DRAFT');
  assert.equal(response.body.data.recipe.visibility, 'PRIVATE');
  assert.equal(response.body.data.recipe.ingredients.length, 1);
  assert.equal(response.body.data.recipe.steps.length, 1);

  const publicList = await request(app).get('/api/v1/recipes');
  assert.equal(publicList.status, 200);
  assert.equal(publicList.body.data.some((recipe) => recipe.id === response.body.data.recipe.id), false);
});

test('publishing incomplete recipe is rejected, then regular user enters review', async () => {
  const user = await createUser('publish');
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${user.token}`).send({
    title: 'Đậu hũ sốt cà',
    ingredients: [{ displayName: 'Đậu hũ' }],
    steps: [{ instruction: 'Áp chảo đậu hũ.' }],
  });
  const recipeId = created.body.data.recipe.id;

  const incomplete = await request(app).post(`/api/v1/recipes/${recipeId}/publish`).set('Authorization', `Bearer ${user.token}`);
  assert.equal(incomplete.status, 422);
  assert.equal(incomplete.body.error.code, 'RECIPE_INCOMPLETE');

  const cover = await prisma.mediaAsset.create({
    data: {
      ownerId: user.id,
      providerPublicId: `test/${user.id}/cover`,
      secureUrl: 'https://res.cloudinary.com/demo/image/upload/cover.jpg',
      format: 'jpg',
      bytes: 1024,
    },
  });
  const updated = await request(app).patch(`/api/v1/recipes/${recipeId}`).set('Authorization', `Bearer ${user.token}`).send({
    coverImageId: cover.id,
  });
  assert.equal(updated.status, 200);

  const published = await request(app).post(`/api/v1/recipes/${recipeId}/publish`).set('Authorization', `Bearer ${user.token}`);
  assert.equal(published.status, 200);
  assert.equal(published.body.data.recipe.status, 'PENDING_REVIEW');
  assert.equal(published.body.data.recipe.visibility, 'PUBLIC');
  assert.equal(published.body.data.recipe.publishedAt, null);
});

test('recipe ownership is enforced and owner can view private recipe by slug', async () => {
  const owner = await createUser('owner');
  const other = await createUser('other');
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${owner.token}`).send({
    title: 'Bữa sáng riêng tư',
    ingredients: [{ displayName: 'Yến mạch' }],
    steps: [{ instruction: 'Trộn cùng sữa.' }],
  });
  const recipe = created.body.data.recipe;

  const forbiddenUpdate = await request(app).patch(`/api/v1/recipes/${recipe.id}`).set('Authorization', `Bearer ${other.token}`).send({ title: 'Không được sửa' });
  assert.equal(forbiddenUpdate.status, 403);
  assert.equal(forbiddenUpdate.body.error.code, 'FORBIDDEN');

  const ownerView = await request(app).get(`/api/v1/recipes/${recipe.slug}`).set('Authorization', `Bearer ${owner.token}`);
  assert.equal(ownerView.status, 200);
  assert.equal(ownerView.body.data.recipe.id, recipe.id);

  const otherView = await request(app).get(`/api/v1/recipes/${recipe.slug}`).set('Authorization', `Bearer ${other.token}`);
  assert.equal(otherView.status, 404);
});

test('recipe search validates query and filters public recipes', async () => {
  const user = await createUser('search');
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${user.token}`).send({
    title: 'Bún rau fixture riêng',
    description: 'Món thanh mát cho ngày nóng',
    cookTimeMinutes: 20,
    ingredients: [{ displayName: 'Nguyên liệu fixture riêng' }],
    steps: [{ instruction: 'Trộn và thưởng thức.' }],
  });
  await prisma.recipe.update({ where: { id: created.body.data.recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });

  const keyword = await request(app).get('/api/v1/recipes').query({ q: 'fixture riêng', maxCookTime: 30 });
  assert.equal(keyword.status, 200);
  assert.equal(keyword.body.data.some((recipe) => recipe.id === created.body.data.recipe.id), true);
  assert.equal(keyword.body.meta.total, 1);

  const invalid = await request(app).get('/api/v1/recipes').query({ limit: 51 });
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
});

test('member can bookmark a public recipe and manage a collection', async () => {
  const author = await createUser('bma');
  const member = await createUser('bmm');
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({
    title: 'Món bookmark fixture',
    ingredients: [{ displayName: 'Đậu' }],
    steps: [{ instruction: 'Nấu chín.' }],
  });
  await prisma.recipe.update({ where: { id: created.body.data.recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
  const collection = await request(app).post('/api/v1/collections').set('Authorization', `Bearer ${member.token}`).send({ name: 'Món sẽ nấu' });
  assert.equal(collection.status, 201);
  const privateOwnerView = await request(app).get(`/api/v1/collections/${collection.body.data.collection.id}`).set('Authorization', `Bearer ${member.token}`);
  assert.equal(privateOwnerView.status, 200);
  const privateGuestView = await request(app).get(`/api/v1/collections/${collection.body.data.collection.id}`);
  assert.equal(privateGuestView.status, 404);
  const publicCollection = await request(app).patch(`/api/v1/collections/${collection.body.data.collection.id}`).set('Authorization', `Bearer ${member.token}`).send({ visibility: 'PUBLIC' });
  assert.equal(publicCollection.status, 200);
  const publicGuestView = await request(app).get(`/api/v1/collections/${collection.body.data.collection.id}`);
  assert.equal(publicGuestView.status, 200);
  const renamed = await request(app).patch(`/api/v1/collections/${collection.body.data.collection.id}`).set('Authorization', `Bearer ${member.token}`).send({ name: 'Món sẽ nấu tuần này' });
  assert.equal(renamed.status, 200);
  const forbiddenCollectionUpdate = await request(app).patch(`/api/v1/collections/${collection.body.data.collection.id}`).set('Authorization', `Bearer ${author.token}`).send({ name: 'Không được sửa' });
  assert.equal(forbiddenCollectionUpdate.status, 404);
  const coverAsset = await prisma.mediaAsset.create({ data: { ownerId: member.id, providerPublicId: `test/${member.id}/collection-cover`, secureUrl: 'https://res.cloudinary.com/demo/image/upload/collection-cover.jpg', format: 'jpg', bytes: 1024 } });
  const foreignCoverAsset = await prisma.mediaAsset.create({ data: { ownerId: author.id, providerPublicId: `test/${author.id}/collection-cover`, secureUrl: 'https://res.cloudinary.com/demo/image/upload/foreign-cover.jpg', format: 'jpg', bytes: 1024 } });
  const deniedCover = await request(app).patch(`/api/v1/collections/${collection.body.data.collection.id}`).set('Authorization', `Bearer ${member.token}`).send({ coverImageId: foreignCoverAsset.id });
  assert.equal(deniedCover.status, 422);
  assert.equal(deniedCover.body.error.code, 'COLLECTION_COVER_INVALID');
  const covered = await request(app).patch(`/api/v1/collections/${collection.body.data.collection.id}`).set('Authorization', `Bearer ${member.token}`).send({ coverImageId: coverAsset.id });
  assert.equal(covered.status, 200);
  assert.equal(covered.body.data.collection.coverImage.secureUrl, coverAsset.secureUrl);
  const attachedCover = await prisma.mediaAsset.findUnique({ where: { id: coverAsset.id }, select: { status: true, attachedAt: true } });
  assert.equal(attachedCover.status, 'ATTACHED');
  assert.ok(attachedCover.attachedAt);
  const clearedCover = await request(app).patch(`/api/v1/collections/${collection.body.data.collection.id}`).set('Authorization', `Bearer ${member.token}`).send({ coverImageId: null });
  assert.equal(clearedCover.status, 200);
  assert.equal(clearedCover.body.data.collection.coverImage, null);
  const saved = await request(app).post(`/api/v1/recipes/${created.body.data.recipe.id}/bookmark`).set('Authorization', `Bearer ${member.token}`).send({ collectionId: collection.body.data.collection.id });
  assert.equal(saved.status, 201);
  const bookmarks = await request(app).get('/api/v1/me/bookmarks').set('Authorization', `Bearer ${member.token}`);
  assert.equal(bookmarks.status, 200);
  assert.equal(bookmarks.body.data.some((item) => item.recipe.id === created.body.data.recipe.id), true);
  const duplicate = await request(app).post(`/api/v1/recipes/${created.body.data.recipe.id}/bookmark`).set('Authorization', `Bearer ${member.token}`).send({ collectionId: collection.body.data.collection.id });
  assert.equal(duplicate.status, 201);
  const recipe = await prisma.recipe.findUnique({ where: { id: created.body.data.recipe.id }, select: { saveCount: true } });
  assert.equal(recipe.saveCount, 1);
  const removedCollection = await request(app).delete(`/api/v1/collections/${collection.body.data.collection.id}`).set('Authorization', `Bearer ${member.token}`);
  assert.equal(removedCollection.status, 204);
  const remainingBookmark = await prisma.bookmark.findUnique({ where: { userId_recipeId: { userId: member.id, recipeId: created.body.data.recipe.id } } });
  assert.equal(remainingBookmark.collectionId, null);
});

test('moderator can resolve recipe report and admin can inspect audit log', async () => {
  const author = await createUser('modauthor');
  const reporter = await createUser('modreporter');
  const moderator = await createUser('moderator');
  const admin = await createUser('admin');
  await prisma.user.update({ where: { id: moderator.id }, data: { role: 'MODERATOR' } });
  await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({
    title: 'Recipe moderation fixture',
    ingredients: [{ displayName: 'Nguyên liệu' }],
    steps: [{ instruction: 'Thực hiện.' }],
  });
  await prisma.recipe.update({ where: { id: created.body.data.recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
  const report = await request(app).post(`/api/v1/recipes/${created.body.data.recipe.id}/report`).set('Authorization', `Bearer ${reporter.token}`).send({ reason: 'SPAM', description: 'Nội dung kiểm thử.' });
  assert.equal(report.status, 201);
  const regularQueue = await request(app).get('/api/v1/moderation/reports').set('Authorization', `Bearer ${reporter.token}`);
  assert.equal(regularQueue.status, 403);
  const moderatorQueue = await request(app).get('/api/v1/moderation/reports').set('Authorization', `Bearer ${moderator.token}`);
  assert.equal(moderatorQueue.status, 200);
  const resolved = await request(app).post(`/api/v1/moderation/reports/${report.body.data.report.id}/resolve`).set('Authorization', `Bearer ${moderator.token}`).send({ action: 'HIDE', note: 'Ẩn để kiểm tra.' });
  assert.equal(resolved.status, 200);
  const hidden = await prisma.recipe.findUnique({ where: { id: created.body.data.recipe.id }, select: { hiddenAt: true } });
  assert.ok(hidden.hiddenAt);
  const publicList = await request(app).get('/api/v1/recipes').query({ q: 'moderation fixture' });
  assert.equal(publicList.body.data.some((recipe) => recipe.id === created.body.data.recipe.id), false);
  const audit = await request(app).get('/api/v1/moderation/audit-logs').set('Authorization', `Bearer ${admin.token}`);
  assert.equal(audit.status, 200);
  assert.equal(audit.body.data.some((log) => log.action === 'REPORT_HIDE'), true);
  const regularAdminApi = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${reporter.token}`);
  assert.equal(regularAdminApi.status, 403);
  const adminUsers = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${admin.token}`);
  assert.equal(adminUsers.status, 200);
  const roleChange = await request(app).patch(`/api/v1/admin/users/${reporter.id}`).set('Authorization', `Bearer ${admin.token}`).send({ role: 'EDITOR' });
  assert.equal(roleChange.status, 200);
  assert.equal(roleChange.body.data.user.role, 'EDITOR');
  const selfReport = await request(app).post(`/api/v1/recipes/${created.body.data.recipe.id}/report`).set('Authorization', `Bearer ${moderator.token}`).send({ reason: 'OTHER' });
  assert.equal(selfReport.status, 201);
  const selfResolve = await request(app).post(`/api/v1/moderation/reports/${selfReport.body.data.report.id}/resolve`).set('Authorization', `Bearer ${moderator.token}`).send({ action: 'DISMISS' });
  assert.equal(selfResolve.status, 403);
});

test('member can create and delete a cooksnap for a public recipe', async () => {
  const author = await createUser('snapauthor');
  const member = await createUser('snapmember');
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({ title: 'Cooksnap fixture', ingredients: [{ displayName: 'Rau' }], steps: [{ instruction: 'Nấu.' }] });
  await prisma.recipe.update({ where: { id: created.body.data.recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
  const invalid = await request(app).post(`/api/v1/recipes/${created.body.data.recipe.id}/cooksnaps`).set('Authorization', `Bearer ${member.token}`).send({ imageUrl: 'not-a-url' });
  assert.equal(invalid.status, 422);
  const createdSnap = await request(app).post(`/api/v1/recipes/${created.body.data.recipe.id}/cooksnaps`).set('Authorization', `Bearer ${member.token}`).send({ imageUrl: 'https://storage.example/cooksnap.jpg', caption: 'Đã nấu thử.' });
  assert.equal(createdSnap.status, 201);
  const listed = await request(app).get(`/api/v1/recipes/${created.body.data.recipe.id}/cooksnaps`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.length, 1);
  const counter = await prisma.recipe.findUnique({ where: { id: created.body.data.recipe.id }, select: { cookSnapCount: true } });
  assert.equal(counter.cookSnapCount, 1);
  const forbiddenEdit = await request(app).patch(`/api/v1/cooksnaps/${createdSnap.body.data.cooksnap.id}`).set('Authorization', `Bearer ${author.token}`).send({ caption: 'Không phải tác giả' });
  assert.equal(forbiddenEdit.status, 403);
  const emptyEdit = await request(app).patch(`/api/v1/cooksnaps/${createdSnap.body.data.cooksnap.id}`).set('Authorization', `Bearer ${member.token}`).send({});
  assert.equal(emptyEdit.status, 422);
  const edited = await request(app).patch(`/api/v1/cooksnaps/${createdSnap.body.data.cooksnap.id}`).set('Authorization', `Bearer ${member.token}`).send({ caption: 'Đã chỉnh sửa nhận xét.' });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.data.cooksnap.caption, 'Đã chỉnh sửa nhận xét.');
  assert.equal(edited.body.data.cooksnap.imageUrl, 'https://storage.example/cooksnap.jpg');
  const removed = await request(app).delete(`/api/v1/cooksnaps/${createdSnap.body.data.cooksnap.id}`).set('Authorization', `Bearer ${member.token}`);
  assert.equal(removed.status, 204);
  const afterRemove = await prisma.recipe.findUnique({ where: { id: created.body.data.recipe.id }, select: { cookSnapCount: true } });
  assert.equal(afterRemove.cookSnapCount, 0);
});

test('media signature endpoint is protected and reports missing provider configuration', async () => {
  const user = await createUser('mediauser');
  const guest = await request(app).post('/api/v1/media/signature');
  assert.equal(guest.status, 401);
  const configured = await request(app).post('/api/v1/media/signature').set('Authorization', `Bearer ${user.token}`);
  assert.ok([200, 503].includes(configured.status));
  if (configured.status === 200) {
    assert.equal(typeof configured.body.data.upload.signature, 'string');
    assert.equal(configured.body.data.upload.resourceType, 'image');
    assert.equal(typeof configured.body.data.upload.mediaAssetId, 'string');
    const reservation = await prisma.mediaAsset.findUnique({ where: { id: configured.body.data.upload.mediaAssetId }, select: { status: true, providerPublicId: true } });
    assert.equal(reservation.status, 'UPLOADED');
    assert.match(reservation.providerPublicId, new RegExp(`^recipe-community/cooksnaps/${user.id}/`));
  } else {
    assert.equal(configured.body.error.code, 'MEDIA_PROVIDER_UNAVAILABLE');
  }
});

test('member can create and soft-delete a comment on a public recipe', async () => {
  const author = await createUser('commentauthor');
  const member = await createUser('commentmember');
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({ title: 'Comment fixture', ingredients: [{ displayName: 'Rau' }], steps: [{ instruction: 'Nấu.' }] });
  await prisma.recipe.update({ where: { id: created.body.data.recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
  const invalid = await request(app).post(`/api/v1/recipes/${created.body.data.recipe.id}/comments`).set('Authorization', `Bearer ${member.token}`).send({ content: '   ' });
  assert.equal(invalid.status, 422);
  const comment = await request(app).post(`/api/v1/recipes/${created.body.data.recipe.id}/comments`).set('Authorization', `Bearer ${member.token}`).send({ content: 'Món này rất dễ làm.' });
  assert.equal(comment.status, 201);
  const listed = await request(app).get(`/api/v1/recipes/${created.body.data.recipe.id}/comments`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.length, 1);
  const forbiddenDelete = await request(app).delete(`/api/v1/comments/${comment.body.data.comment.id}`).set('Authorization', `Bearer ${author.token}`);
  assert.equal(forbiddenDelete.status, 403);
  const removed = await request(app).delete(`/api/v1/comments/${comment.body.data.comment.id}`).set('Authorization', `Bearer ${member.token}`);
  assert.equal(removed.status, 204);
  const afterRemove = await request(app).get(`/api/v1/recipes/${created.body.data.recipe.id}/comments`);
  assert.equal(afterRemove.body.data.length, 0);
});

test('member can follow an author and read paginated feed', async () => {
  const author = await createUser('feedauthor');
  const member = await createUser('feedmember');
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({ title: 'Feed fixture', description: 'Feed content', ingredients: [{ displayName: 'Rau' }], steps: [{ instruction: 'Nấu.' }] });
  await prisma.recipe.update({ where: { id: created.body.data.recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
  const self = await request(app).post(`/api/v1/users/${member.id}/follow`).set('Authorization', `Bearer ${member.token}`);
  assert.equal(self.status, 422);
  const followed = await request(app).post(`/api/v1/users/${author.id}/follow`).set('Authorization', `Bearer ${member.token}`);
  assert.equal(followed.status, 204);
  await request(app).post(`/api/v1/recipes/${created.body.data.recipe.id}/cooksnaps`).set('Authorization', `Bearer ${author.token}`).send({ imageUrl: 'https://storage.example/feed-snap.jpg', caption: 'Feed snap' });
  const feed = await request(app).get('/api/v1/me/feed?page=1&limit=10').set('Authorization', `Bearer ${member.token}`);
  assert.equal(feed.status, 200);
  assert.equal(feed.body.data.some((event) => event.type === 'RECIPE' && event.recipe.id === created.body.data.recipe.id), true);
  assert.equal(feed.body.data.some((event) => event.type === 'COOKSNAP' && event.cooksnap.recipeId === created.body.data.recipe.id), true);
  assert.equal(feed.body.meta.mode, 'FOLLOWING');
  const authorRecord = await prisma.user.findUnique({ where: { id: author.id }, select: { username: true } });
  const profile = await request(app).get(`/api/v1/users/${authorRecord.username}`).set('Authorization', `Bearer ${member.token}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.data.profile.isFollowing, true);
  assert.equal(profile.body.data.profile._count.followsTo, 1);
  const unfollowed = await request(app).delete(`/api/v1/users/${author.id}/follow`).set('Authorization', `Bearer ${member.token}`);
  assert.equal(unfollowed.status, 204);
});

test('moderator can report and hide a comment target', async () => {
  const author = await createUser('tgta');
  const reporter = await createUser('tgtr');
  const moderator = await createUser('tgtm');
  await prisma.user.update({ where: { id: moderator.id }, data: { role: 'MODERATOR' } });
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({ title: 'Target report fixture', ingredients: [{ displayName: 'Rau' }], steps: [{ instruction: 'Nấu.' }] });
  await prisma.recipe.update({ where: { id: created.body.data.recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
  const comment = await request(app).post(`/api/v1/recipes/${created.body.data.recipe.id}/comments`).set('Authorization', `Bearer ${reporter.token}`).send({ content: 'Reported text' });
  const report = await request(app).post(`/api/v1/moderation/COMMENT/${comment.body.data.comment.id}/report`).set('Authorization', `Bearer ${author.token}`).send({ reason: 'HARASSMENT' });
  assert.equal(report.status, 201);
  const queue = await request(app).get('/api/v1/moderation/reports').set('Authorization', `Bearer ${moderator.token}`);
  assert.equal(queue.status, 200);
  const targetReport = queue.body.data.find((item) => item.id === report.body.data.report.id);
  assert.equal(targetReport.comment.content, 'Reported text');
  const hidden = await request(app).post(`/api/v1/moderation/reports/${targetReport.id}/resolve`).set('Authorization', `Bearer ${moderator.token}`).send({ action: 'HIDE' });
  assert.equal(hidden.status, 200);
  const comments = await request(app).get(`/api/v1/recipes/${created.body.data.recipe.id}/comments`);
  assert.equal(comments.body.data.some((item) => item.id === comment.body.data.comment.id), false);
});

test('cooksnap attaches only a media asset owned by the submitting member', async () => {
  const author = await createUser('assetauthor');
  const member = await createUser('assetmember');
  const other = await createUser('assetother');
  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({ title: 'Media asset fixture', ingredients: [{ displayName: 'Rau' }], steps: [{ instruction: 'Nấu.' }] });
  await prisma.recipe.update({ where: { id: created.body.data.recipe.id }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date() } });
  const asset = await prisma.mediaAsset.create({ data: { ownerId: member.id, providerPublicId: `test/${member.id}/asset`, secureUrl: 'https://res.cloudinary.com/demo/image/upload/test.jpg', format: 'jpg', bytes: 1024 } });
  const denied = await request(app).post(`/api/v1/recipes/${created.body.data.recipe.id}/cooksnaps`).set('Authorization', `Bearer ${other.token}`).send({ mediaAssetId: asset.id, caption: 'No ownership' });
  assert.equal(denied.status, 403);
  const attached = await request(app).post(`/api/v1/recipes/${created.body.data.recipe.id}/cooksnaps`).set('Authorization', `Bearer ${member.token}`).send({ mediaAssetId: asset.id, caption: 'Owned upload' });
  assert.equal(attached.status, 201);
  assert.equal(attached.body.data.cooksnap.imageUrl, asset.secureUrl);
  const state = await prisma.mediaAsset.findUnique({ where: { id: asset.id }, select: { status: true, attachedAt: true } });
  assert.equal(state.status, 'ATTACHED');
  assert.ok(state.attachedAt);
});

test('recipe gallery stores up to six owned media assets and can be replaced', async () => {
  const author = await createUser('galleryauthor');
  const other = await createUser('galleryother');
  const makeAsset = (ownerId, name) => prisma.mediaAsset.create({
    data: { ownerId, providerPublicId: `test/${ownerId}/${name}`, secureUrl: `https://res.cloudinary.com/demo/image/upload/${name}.jpg`, format: 'jpg', bytes: 1024 },
  });
  const [first, second, third] = await Promise.all([
    makeAsset(author.id, 'gallery-1'),
    makeAsset(author.id, 'gallery-2'),
    makeAsset(author.id, 'gallery-3'),
  ]);
  const foreign = await makeAsset(other.id, 'gallery-foreign');

  const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({
    title: 'Gallery fixture',
    ingredients: [{ displayName: 'Rau' }],
    steps: [{ instruction: 'Nấu.' }],
    imageIds: [first.id, second.id],
  });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.data.recipe.images.map((image) => image.mediaAssetId), [first.id, second.id]);
  assert.equal(created.body.data.recipe.images[0].mediaAsset.secureUrl, first.secureUrl);
  const attached = await prisma.mediaAsset.findMany({ where: { id: { in: [first.id, second.id] } }, select: { status: true } });
  assert.ok(attached.every((asset) => asset.status === 'ATTACHED'));

  const foreignAttempt = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({
    title: 'Foreign gallery fixture',
    ingredients: [{ displayName: 'Rau' }],
    steps: [{ instruction: 'Nấu.' }],
    imageIds: [foreign.id],
  });
  assert.equal(foreignAttempt.status, 422);
  assert.equal(foreignAttempt.body.error.code, 'RECIPE_GALLERY_INVALID');

  const tooMany = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({
    title: 'Too many gallery fixture',
    ingredients: [{ displayName: 'Rau' }],
    steps: [{ instruction: 'Nấu.' }],
    imageIds: ['1', '2', '3', '4', '5', '6', '7'],
  });
  assert.equal(tooMany.status, 422);

  const replaced = await request(app).patch(`/api/v1/recipes/${created.body.data.recipe.id}`).set('Authorization', `Bearer ${author.token}`).send({ imageIds: [third.id] });
  assert.equal(replaced.status, 200);
  assert.deepEqual(replaced.body.data.recipe.images.map((image) => image.mediaAssetId), [third.id]);

  const listed = await request(app).get(`/api/v1/recipes/${created.body.data.recipe.slug}`).set('Authorization', `Bearer ${author.token}`);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.data.recipe.images.map((image) => image.mediaAssetId), [third.id]);

  const cleared = await request(app).patch(`/api/v1/recipes/${created.body.data.recipe.id}`).set('Authorization', `Bearer ${author.token}`).send({ imageIds: [] });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.data.recipe.images.length, 0);
});

test('Cloudinary provider verification works with a fetch stub', async () => {  const owner = await createUser('cloudstub');
  const publicId = `recipe-community/cooksnaps/${owner.id}/stub-image`;
  const asset = await prisma.mediaAsset.create({ data: { ownerId: owner.id, providerPublicId: publicId } });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ public_id: publicId, secure_url: 'https://res.cloudinary.com/replace-with-cloud-name/image/upload/stub.jpg', format: 'jpg', bytes: 1024 }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const registered = await registerUploadedAsset(owner.id, { mediaAssetId: asset.id, publicId });
    assert.equal(registered.status, 'UPLOADED');
    assert.equal(registered.secureUrl, 'https://res.cloudinary.com/replace-with-cloud-name/image/upload/stub.jpg');
    assert.equal(registered.bytes, 1024);
  } finally { globalThis.fetch = originalFetch; }
});

test('cleanup removes detached attached assets and keeps referenced ones', async () => {
  const owner = await createUser('cleanup');
  const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const detached = await prisma.mediaAsset.create({
    data: { ownerId: owner.id, providerPublicId: `test/${owner.id}/cleanup-detached`, secureUrl: 'https://res.cloudinary.com/demo/image/upload/cleanup-detached.jpg', status: 'ATTACHED', attachedAt: new Date(), createdAt: old },
  });
  const referenced = await prisma.mediaAsset.create({
    data: { ownerId: owner.id, providerPublicId: `test/${owner.id}/cleanup-referenced`, secureUrl: 'https://res.cloudinary.com/demo/image/upload/cleanup-referenced.jpg', status: 'ATTACHED', attachedAt: new Date(), createdAt: old },
  });
  const recipe = await prisma.recipe.create({
    data: {
      authorId: owner.id,
      title: 'Cleanup fixture',
      slug: `cleanup-fixture-${suffix}`,
      coverImageId: referenced.id,
      ingredients: { create: [{ displayName: 'Rau', sortOrder: 0 }] },
      steps: { create: [{ instruction: 'Nấu chín.', stepNumber: 1 }] },
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ result: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    await cleanupOrphanMediaAssets({ olderThanHours: 24 });
    const detachedState = await prisma.mediaAsset.findUnique({ where: { id: detached.id }, select: { status: true, deletedAt: true } });
    assert.equal(detachedState.status, 'DELETED');
    assert.ok(detachedState.deletedAt);
    const referencedState = await prisma.mediaAsset.findUnique({ where: { id: referenced.id }, select: { status: true } });
    assert.equal(referencedState.status, 'ATTACHED');
  } finally {
    globalThis.fetch = originalFetch;
    await prisma.recipe.delete({ where: { id: recipe.id } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: [detached.id, referenced.id] } } });
  }
});

test('user can list notifications and mark them read', async () => {
  const user = await createUser('notifuser');
  const admin = await createUser('notifadmin');
  await prisma.notification.create({ data: { userId: user.id, type: 'MODERATION_WARNING', title: 'Cảnh báo', message: 'Nội dung cần xem lại.' } });
  const listed = await request(app).get('/api/v1/me/notifications').set('Authorization', `Bearer ${user.token}`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.meta.unread, 1);
  const notificationId = listed.body.data[0].id;
  const marked = await request(app).patch(`/api/v1/me/notifications/${notificationId}/read`).set('Authorization', `Bearer ${user.token}`);
  assert.equal(marked.status, 204);
  const allRead = await request(app).post('/api/v1/me/notifications/read-all').set('Authorization', `Bearer ${user.token}`);
  assert.equal(allRead.status, 204);
  await prisma.notification.deleteMany({ where: { userId: { in: [user.id, admin.id] } } });
});

test('search ranks title matches before ingredient and description matches', async () => {
  const author = await createUser('rank');
  const token = `zzrank${suffix}`;
  async function publish(payload) {
    const created = await request(app).post('/api/v1/recipes').set('Authorization', `Bearer ${author.token}`).send({
      ingredients: [{ displayName: 'Rau cải' }],
      steps: [{ instruction: 'Nấu chín.' }],
      ...payload,
    });
    assert.equal(created.status, 201);
    return created.body.data.recipe.id;
  }

  const titleMatch = await publish({ title: `Món ${token} đặc biệt`, description: 'Công thức kiểm thử xếp hạng.' });
  await prisma.recipe.update({ where: { id: titleMatch }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) } });
  const ingredientMatch = await publish({ title: 'Món xào rau củ', description: 'Công thức kiểm thử xếp hạng.', ingredients: [{ displayName: `${token} tươi` }] });
  await prisma.recipe.update({ where: { id: ingredientMatch }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
  const descriptionMatch = await publish({ title: 'Món canh chua', description: `Hướng dẫn nấu món ${token} chuẩn vị.` });
  await prisma.recipe.update({ where: { id: descriptionMatch }, data: { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: new Date(Date.now() - 60 * 60 * 1000) } });

  const searched = await request(app).get('/api/v1/recipes').query({ q: token, limit: 10 });
  assert.equal(searched.status, 200);
  const orderedIds = searched.body.data.map((recipe) => recipe.id).filter((id) => [titleMatch, ingredientMatch, descriptionMatch].includes(id));
  assert.deepEqual(orderedIds, [titleMatch, ingredientMatch, descriptionMatch]);
  assert.ok(searched.body.meta.total >= 3);

  const secondPage = await request(app).get('/api/v1/recipes').query({ q: token, limit: 2, page: 2 });
  assert.equal(secondPage.status, 200);
  assert.equal(secondPage.body.data.length >= 1, true);
});
