import IORedis, { RedisOptions } from "ioredis";
import { config } from "dotenv";

config();

export const redisConnection: RedisOptions = {
    host: process.env.AUTOMATION_REDIS_HOST || "localhost",
    port: parseInt(process.env.AUTOMATION_REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
};

// Cliente exportável (opcional)
export const redisClient = new IORedis(redisConnection);
