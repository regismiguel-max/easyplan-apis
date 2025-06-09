import { RedisOptions } from "ioredis";
import { config } from "dotenv";

config();

export const redisConfig: RedisOptions = {
    host: process.env.CAMPAIGN_REDIS_HOST || "127.0.0.1",
    port: Number(process.env.CAMPAIGN_REDIS_PORT) || 6379,
}