import { getRedisStatus } from '../middlewares/rateLimit.js';

export function getHealth(_request, response) {
  response.status(200).json({
    data: { status: 'ok' },
    meta: {},
    error: null,
  });
}

export async function getRedisHealth(_request, response) { response.json({ data: await getRedisStatus(), meta: {}, error: null }); }
