const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Queue } = require('bullmq');

const redisConfig = {
  host: process.env.CAMPAIGN_REDIS_HOST || '127.0.0.1',
  port: Number(process.env.CAMPAIGN_REDIS_PORT || 6379)
};

const campaignQueue = new Queue('campaignQueue', {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

module.exports = campaignQueue;
