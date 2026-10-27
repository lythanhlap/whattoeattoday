import { createClient } from 'redis';
import { env } from '../config/env.js';

let redisClientPromise;
const memoryBuckets = new Map();

async function getRedisClient() {
  if (!env.redisUrl) return null;
  if (!redisClientPromise) {
    const client = createClient({ url: env.redisUrl, socket: { connectTimeout: 500, reconnectStrategy: false } });
    client.on('error', () => {});
    redisClientPromise = client.connect().then(() => { client.unref?.(); return client; }).catch(() => null);
  }
  return redisClientPromise;
}

function limitedError(retryAfterSeconds) {
  const error = new Error('Too many requests'); error.statusCode = 429; error.code = 'RATE_LIMITED'; error.details = { retryAfterSeconds }; return error;
}

export function rateLimit({ windowMs = 60_000, max = 30, key = (request) => request.ip } = {}) {
  return async (request, _response, next) => {
    const bucketKey = `rate:${key(request)}:${request.baseUrl}${request.path}`;
    try {
      const redis = await getRedisClient();
      if (redis) {
        const count = await redis.incr(bucketKey);
        if (count === 1) await redis.expire(bucketKey, Math.ceil(windowMs / 1000));
        if (count > max) { const ttl = await redis.ttl(bucketKey); return next(limitedError(Math.max(ttl, 1))); }
        return next();
      }
    } catch { /* Fall through to local limiter when Redis is unavailable. */ }
    const now = Date.now(); const current = memoryBuckets.get(bucketKey);
    if (!current || now - current.startedAt >= windowMs) { memoryBuckets.set(bucketKey, { startedAt: now, count: 1 }); return next(); }
    current.count += 1;
    if (current.count > max) return next(limitedError(Math.ceil((windowMs - (now - current.startedAt)) / 1000)));
    return next();
  };
}

function parseRedisInfo(info) {
  return Object.fromEntries(String(info).split('\r\n').filter((line) => line && !line.startsWith('#')).map((line) => {
    const index = line.indexOf(':');
    return index > 0 ? [line.slice(0, index), line.slice(index + 1)] : null;
  }).filter(Boolean));
}

async function getEvictionPolicy(redis) {
  try {
    const result = await redis.configGet('maxmemory-policy');
    if (Array.isArray(result)) return result[1] || null;
    return result?.['maxmemory-policy'] || null;
  } catch {
    return null;
  }
}

export async function getRedisStatus() {
  const redis = await getRedisClient();
  if (!redis) return { configured: Boolean(env.redisUrl), connected: false, mode: 'memory-fallback' };
  try {
    const [pong, memoryInfo, serverInfo, evictionPolicy] = await Promise.all([
      redis.ping(),
      redis.info('memory'),
      redis.info('server'),
      getEvictionPolicy(redis),
    ]);
    const memory = parseRedisInfo(memoryInfo);
    const server = parseRedisInfo(serverInfo);
    return {
      configured: true,
      connected: pong === 'PONG',
      mode: 'redis',
      evictionPolicy,
      maxmemoryPolicy: evictionPolicy,
      usedMemory: memory.used_memory_human || null,
      maxMemory: memory.maxmemory_human || null,
      connectedClients: memory.connected_clients ? Number(memory.connected_clients) : null,
      uptimeSeconds: server.uptime_in_seconds ? Number(server.uptime_in_seconds) : null,
      redisVersion: server.redis_version || null,
    };
  } catch {
    return { configured: true, connected: false, mode: 'memory-fallback' };
  }
}
