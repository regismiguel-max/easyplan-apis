const express = require('express');
const { createBullBoard } = require('bull-board');
const { BullAdapter } = require('bull-board/bullAdapter');
const { BullMQAdapter } = require('bull-board/bullMQAdapter');

const pushQueue = require('../queues/push/pushQueue');
const campaignQueue = require('../queues/campaign/campaignQueue');

const { router } = createBullBoard([
  new BullAdapter(pushQueue),
  new BullMQAdapter(campaignQueue)
]);

const app = express();
app.use('/admin/queues', router);

const PORT = 3030;
app.listen(PORT, () => {
  console.log(`📊 Bull Board disponível em http://localhost:${PORT}/admin/queues`);
});
