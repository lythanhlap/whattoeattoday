import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { cleanupOrphanMediaAssets, createUploadSignature, registerUploadedAsset } from '../src/services/mediaService.js';

const app = createApp();
const suffix = Date.now().toString().slice(-8);
const placeholder = (value) => !value || value.startsWith('replace-with-');
const configured = [process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET].every((value) => !placeholder(value));
const skip = configured ? false : 'Real Cloudinary credentials are required (npm run test:cloudinary uses server/.env)';
const createdUsers = [];

const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');

after(async () => {
  for (const id of createdUsers) {
    await prisma.mediaAsset.deleteMany({ where: { ownerId: id } });
    await prisma.userProfile.deleteMany({ where: { userId: id } });
    await prisma.refreshToken.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

test('signed Cloudinary upload can be registered and later cleaned up', { skip }, async () => {
  const registration = await request(app).post('/api/v1/auth/register').send({
    email: `media-upload-${suffix}@example.com`,
    username: `media_upload_${suffix}`,
    password: 'correct horse battery staple',
    displayName: 'Media Upload',
  });
  assert.equal(registration.status, 201);
  const userId = registration.body.data.user.id;
  createdUsers.push(userId);

  const signature = await createUploadSignature(userId, 'cooksnap');
  const form = new FormData();
  form.append('file', new Blob([onePixelPng], { type: 'image/png' }), 'integration.png');
  form.append('api_key', signature.apiKey);
  form.append('timestamp', String(signature.timestamp));
  form.append('signature', signature.signature);
  form.append('folder', signature.folder);
  form.append('public_id', signature.publicId);
  form.append('allowed_formats', signature.allowedFormats);

  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: 'POST', body: form });
  const upload = await uploadResponse.json().catch(() => null);
  assert.equal(uploadResponse.status, 200, `Cloudinary upload failed: ${JSON.stringify(upload)}`);
  assert.equal(upload.public_id, `${signature.folder}/${signature.publicId}`);

  const asset = await registerUploadedAsset(userId, { mediaAssetId: signature.mediaAssetId, publicId: upload.public_id });
  assert.equal(asset.status, 'UPLOADED');
  assert.equal(asset.bytes, upload.bytes);
  assert.equal(asset.secureUrl, upload.secure_url);

  await prisma.mediaAsset.update({ where: { id: asset.id }, data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } });
  const cleanup = await cleanupOrphanMediaAssets({ olderThanHours: 24 });
  assert.ok(cleanup.deleted >= 1);

  const stored = await prisma.mediaAsset.findUnique({ where: { id: asset.id } });
  assert.equal(stored.status, 'DELETED');

  const resourcePath = upload.public_id.split('/').map(encodeURIComponent).join('/');
  const providerResponse = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/resources/image/upload/${resourcePath}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${signature.apiKey}:${process.env.CLOUDINARY_API_SECRET}`).toString('base64')}` },
  });
  assert.equal(providerResponse.status, 404);
});
