import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

function configurationError() { const error = new Error('Cloudinary is not configured'); error.statusCode = 503; error.code = 'MEDIA_PROVIDER_UNAVAILABLE'; return error; }

const UPLOAD_FOLDERS = {
  cooksnap: 'cooksnaps',
  recipe: 'recipes',
  avatar: 'avatars',
  challenge: 'challenges',
};

export async function createUploadSignature(userId, purpose = 'cooksnap') {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) throw configurationError();
  const folderName = UPLOAD_FOLDERS[purpose];
  if (!folderName) { const error = new Error('Upload purpose is invalid'); error.statusCode = 422; error.code = 'MEDIA_PURPOSE_INVALID'; throw error; }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `recipe-community/${folderName}/${userId}`;
  const publicId = crypto.randomUUID();
  const fullPublicId = `${folder}/${publicId}`;
  const allowedFormats = 'jpg,png,jpeg,webp';
  const toSign = `allowed_formats=${allowedFormats}&folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(`${toSign}${env.cloudinaryApiSecret}`).digest('hex');
  const asset = await prisma.mediaAsset.create({ data: { ownerId: userId, providerPublicId: fullPublicId } });
  return { cloudName: env.cloudinaryCloudName, apiKey: env.cloudinaryApiKey, timestamp, folder, publicId, mediaAssetId: asset.id, signature, resourceType: 'image', allowedFormats, maxFileSize: env.cloudinaryMaxFileSize };
}

function validateCloudinaryConfig() { if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) throw configurationError(); }

async function getCloudinaryResource(publicId) {
  validateCloudinaryConfig();
  const resourcePath = publicId.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/resources/image/upload/${resourcePath}`, { headers: { Authorization: `Basic ${Buffer.from(`${env.cloudinaryApiKey}:${env.cloudinaryApiSecret}`).toString('base64')}` } });
  if (response.status === 404) { const error = new Error('Uploaded image was not found'); error.statusCode = 422; error.code = 'MEDIA_ASSET_NOT_FOUND'; throw error; }
  if (!response.ok) { const error = new Error('Unable to verify uploaded image'); error.statusCode = 502; error.code = 'MEDIA_PROVIDER_ERROR'; throw error; }
  return response.json();
}

export async function registerUploadedAsset(ownerId, input) {
  const expectedFolder = new RegExp(`^recipe-community/(cooksnaps|recipes|avatars|challenges)/${ownerId}/`);
  if (typeof input.publicId !== 'string' || !expectedFolder.test(input.publicId) || typeof input.mediaAssetId !== 'string') { const error = new Error('Upload does not belong to the current user'); error.statusCode = 403; error.code = 'MEDIA_ASSET_FORBIDDEN'; throw error; }
  const resource = await getCloudinaryResource(input.publicId);
  const formats = new Set(['jpg', 'jpeg', 'png', 'webp']);
  if (resource.public_id !== input.publicId || !formats.has(resource.format) || resource.bytes > env.cloudinaryMaxFileSize || !resource.secure_url?.startsWith(`https://res.cloudinary.com/${env.cloudinaryCloudName}/`)) {
    const error = new Error('Uploaded image does not meet media policy'); error.statusCode = 422; error.code = 'MEDIA_POLICY_VIOLATION'; throw error;
  }
  try {
    const update = await prisma.mediaAsset.updateMany({ where: { id: input.mediaAssetId, ownerId, providerPublicId: resource.public_id, status: 'UPLOADED', attachedAt: null }, data: { secureUrl: resource.secure_url, format: resource.format, bytes: resource.bytes } });
    if (!update.count) { const error = new Error('Media upload reservation was not found'); error.statusCode = 404; error.code = 'MEDIA_ASSET_NOT_FOUND'; throw error; }
    return prisma.mediaAsset.findUnique({ where: { id: input.mediaAssetId } });
  } catch (dbError) {
    if (dbError.code === 'P2002') { const error = new Error('Upload is already registered'); error.statusCode = 409; error.code = 'MEDIA_ASSET_ALREADY_REGISTERED'; throw error; }
    throw dbError;
  }
}

export async function cleanupOrphanMediaAssets({ olderThanHours = 24, limit = 100 } = {}) {
  validateCloudinaryConfig();
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const assets = await prisma.mediaAsset.findMany({ where: { status: 'UPLOADED', attachedAt: null, createdAt: { lt: cutoff } }, take: Math.min(limit, 500), orderBy: { createdAt: 'asc' } });
  let deleted = 0;
  for (const asset of assets) {
    const claimed = await prisma.mediaAsset.updateMany({ where: { id: asset.id, status: 'UPLOADED', attachedAt: null }, data: { status: 'CLEANING' } });
    if (!claimed.count) continue;
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${asset.providerPublicId}&timestamp=${timestamp}`;
    const signature = crypto.createHash('sha1').update(`${toSign}${env.cloudinaryApiSecret}`).digest('hex');
    const body = new URLSearchParams({ public_id: asset.providerPublicId, timestamp: String(timestamp), api_key: env.cloudinaryApiKey, signature });
    const response = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/image/destroy`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${env.cloudinaryApiKey}:${env.cloudinaryApiSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const result = await response.json().catch(() => null);
    if (response.ok && ['ok', 'not found'].includes(result?.result)) {
      await prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: 'DELETED', deletedAt: new Date() } });
      deleted += 1;
    } else await prisma.mediaAsset.updateMany({ where: { id: asset.id, status: 'CLEANING' }, data: { status: 'UPLOADED' } });
  }
  return { scanned: assets.length, deleted };
}
