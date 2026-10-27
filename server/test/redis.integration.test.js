import assert from 'node:assert/strict';
import test from 'node:test';
import { getRedisStatus } from '../src/middlewares/rateLimit.js';

const enabled = process.env.RUN_REDIS_INTEGRATION === '1' && Boolean(process.env.REDIS_URL);

test('Redis health reports connection, memory and eviction policy', { skip: enabled ? false : 'Set RUN_REDIS_INTEGRATION=1 and REDIS_URL to run this integration test.' }, async () => {
  // The Redis client is unref'ed so the API process can exit cleanly. Keep the
  // test event loop alive while the first connection is being established.
  const keepAlive = setInterval(() => {}, 1000);
  let status;
  try {
    status = await getRedisStatus();
  } finally {
    clearInterval(keepAlive);
  }
  assert.equal(status.configured, true);
  assert.equal(status.connected, true);
  assert.equal(status.mode, 'redis');
  assert.ok(status.usedMemory);
  assert.ok(status.redisVersion);
  if (status.evictionPolicy) assert.match(status.evictionPolicy, /lru|noeviction|allkeys/);
});
