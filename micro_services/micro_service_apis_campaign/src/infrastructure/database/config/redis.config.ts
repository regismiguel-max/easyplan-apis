import { createClient } from 'redis';

const redisHost = process.env.CAMPAIGN_REDIS_HOST || '127.0.0.1';
const redisPort = process.env.CAMPAIGN_REDIS_PORT || '6379';

const redisUrl = `redis://${redisHost}:${redisPort}`;

export const redisClient = createClient({
    url: redisUrl,
});

redisClient.on('error', (err) => console.log('❌ Redis Client Error', err));

(async () => {
    await redisClient.connect();
    console.log(`🔗 Redis conectado em ${redisUrl}`);
})();