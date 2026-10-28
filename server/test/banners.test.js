import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();
const suffix = Date.now().toString().slice(-8);
const users = [];
const bannerIds = [];
const assetIds = [];

async function createUser(label) {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: `banner-${label}-${suffix}@example.com`,
    username: `bn_${label}_${suffix}`.slice(0, 30),
    password: 'correct horse battery staple',
    displayName: `Banner ${label}`,
  });
  assert.equal(response.status, 201);
  users.push(response.body.data.user.id);
  return { id: response.body.data.user.id, token: response.body.data.accessToken };
}

async function asRole(user, role) {
  await prisma.user.update({ where: { id: user.id }, data: { role } });
  return user;
}

async function createMediaAsset(ownerId, label) {
  const asset = await prisma.mediaAsset.create({
    data: {
      ownerId,
      providerPublicId: `test/banners/${ownerId}/${label}-${suffix}`,
      secureUrl: `https://res.cloudinary.com/demo/image/upload/${label}-${suffix}.jpg`,
      format: 'jpg',
      bytes: 2048,
      status: 'ATTACHED',
      attachedAt: new Date(),
    },
  });
  assetIds.push(asset.id);
  return asset;
}

async function createBanner(user, asset, extra = {}) {
  const response = await request(app)
    .post('/api/v1/editorial/banners')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ title: `Banner ${suffix}`, imageId: asset.id, ...extra });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  bannerIds.push(response.body.data.banner.id);
  return response.body.data.banner;
}

after(async () => {
  await prisma.banner.deleteMany({ where: { createdById: { in: users } } });
  await prisma.mediaAsset.deleteMany({ where: { ownerId: { in: users } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

test('members cannot manage editorial banners', async () => {
  const member = await createUser('member');
  const asset = await createMediaAsset(member.id, 'member-asset');

  const created = await request(app)
    .post('/api/v1/editorial/banners')
    .set('Authorization', `Bearer ${member.token}`)
    .send({ title: 'Banner của thành viên', imageId: asset.id });
  assert.equal(created.status, 403);

  const list = await request(app).get('/api/v1/editorial/banners').set('Authorization', `Bearer ${member.token}`);
  assert.equal(list.status, 403);
});

test('editors create banners with their own images only', async () => {
  const editor = await asRole(await createUser('editor'), 'EDITOR');
  const other = await createUser('other');
  const ownAsset = await createMediaAsset(editor.id, 'own');
  const foreignAsset = await createMediaAsset(other.id, 'foreign');

  const foreign = await request(app)
    .post('/api/v1/editorial/banners')
    .set('Authorization', `Bearer ${editor.token}`)
    .send({ title: 'Banner mượn ảnh', imageId: foreignAsset.id });
  assert.equal(foreign.status, 422);
  assert.equal(foreign.body.error.code, 'BANNER_IMAGE_INVALID');

  const banner = await createBanner(editor, ownAsset, { subtitle: 'Chủ đề tuần này', linkUrl: '/cong-thuc?diet=mon-chay' });
  assert.equal(banner.isActive, true);
  assert.equal(banner.sortOrder, 0);
});

test('banner input is validated', async () => {
  const editor = await asRole(await createUser('validator'), 'EDITOR');
  const asset = await createMediaAsset(editor.id, 'valid');

  const shortTitle = await request(app)
    .post('/api/v1/editorial/banners')
    .set('Authorization', `Bearer ${editor.token}`)
    .send({ title: 'ab', imageId: asset.id });
  assert.equal(shortTitle.status, 422);

  const badLink = await request(app)
    .post('/api/v1/editorial/banners')
    .set('Authorization', `Bearer ${editor.token}`)
    .send({ title: 'Banner hợp lệ', imageId: asset.id, linkUrl: 'javascript:alert(1)' });
  assert.equal(badLink.status, 422);

  const badWindow = await request(app)
    .post('/api/v1/editorial/banners')
    .set('Authorization', `Bearer ${editor.token}`)
    .send({
      title: 'Banner hợp lệ',
      imageId: asset.id,
      startsAt: '2026-12-01T10:00:00.000Z',
      endsAt: '2026-11-01T10:00:00.000Z',
    });
  assert.equal(badWindow.status, 422);

  const unknownBanner = await request(app)
    .patch(`/api/v1/editorial/banners/${asset.id}`)
    .set('Authorization', `Bearer ${editor.token}`)
    .send({ title: 'Không tồn tại' });
  assert.equal(unknownBanner.status, 404);
  assert.equal(unknownBanner.body.error.code, 'BANNER_NOT_FOUND');
});

test('public list exposes only active banners inside their schedule', async () => {
  const editor = await asRole(await createUser('public'), 'EDITOR');
  const asset = await createMediaAsset(editor.id, 'public');
  const past = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const visible = await createBanner(editor, asset, { title: `Hiện ${suffix}`, sortOrder: 1 });
  const hidden = await createBanner(editor, asset, { title: `Tắt ${suffix}`, isActive: false });
  const upcoming = await createBanner(editor, asset, { title: `Sắp tới ${suffix}`, startsAt: future });
  const expired = await createBanner(editor, asset, { title: `Hết hạn ${suffix}`, endsAt: past });

  const response = await request(app).get('/api/v1/banners');
  assert.equal(response.status, 200);
  const ids = response.body.data.map((banner) => banner.id);
  assert.ok(ids.includes(visible.id));
  for (const banner of [hidden, upcoming, expired]) assert.ok(!ids.includes(banner.id));
  const listed = response.body.data.find((banner) => banner.id === visible.id);
  assert.ok(listed.image.secureUrl.startsWith('https://res.cloudinary.com/'));
});

test('editors update, deactivate and soft delete banners', async () => {
  const editor = await asRole(await createUser('manage'), 'EDITOR');
  const asset = await createMediaAsset(editor.id, 'manage');
  const banner = await createBanner(editor, asset, { title: `Quản lý ${suffix}` });

  const updated = await request(app)
    .patch(`/api/v1/editorial/banners/${banner.id}`)
    .set('Authorization', `Bearer ${editor.token}`)
    .send({ title: `Đã sửa ${suffix}`, isActive: false });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.banner.title, `Đã sửa ${suffix}`);
  assert.equal(updated.body.data.banner.isActive, false);

  const removed = await request(app)
    .delete(`/api/v1/editorial/banners/${banner.id}`)
    .set('Authorization', `Bearer ${editor.token}`);
  assert.equal(removed.status, 204);

  const deleted = await request(app)
    .patch(`/api/v1/editorial/banners/${banner.id}`)
    .set('Authorization', `Bearer ${editor.token}`)
    .send({ title: 'Sau khi xóa' });
  assert.equal(deleted.status, 404);

  const publicList = await request(app).get('/api/v1/banners');
  assert.ok(!publicList.body.data.some((item) => item.id === banner.id));
});

test('banner image upload uses the banners folder', async () => {
  const editor = await asRole(await createUser('upload'), 'EDITOR');
  const signature = await request(app).post('/api/v1/media/signature').set('Authorization', `Bearer ${editor.token}`).send({ purpose: 'banner' });
  if (signature.status === 503) return; // Cloudinary not configured in this environment
  assert.equal(signature.status, 200);
  assert.equal(signature.body.data.upload.folder, `recipe-community/banners/${editor.id}`);
});
