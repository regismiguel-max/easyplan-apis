const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const Queue = require('bull');

const pushQueue = new Queue('push-boletos', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  }
});

module.exports = pushQueue;