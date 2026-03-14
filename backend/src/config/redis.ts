import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = Number(process.env.REDIS_PORT) || 6379;

console.log(`[Redis] Connecting to ${redisHost}:${redisPort}...`);

const redis = new Redis({
  host: redisHost,
  port: redisPort,
  retryStrategy: (times) => {
    // Retry connection after a delay
    return Math.min(times * 50, 2000);
  }
});

redis.on('error', (err) => {
  console.error('[Redis Error]', err);
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

export { redis };
