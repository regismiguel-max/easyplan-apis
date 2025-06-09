const { CronJob } = require('cron');
const { verifyStatusPayment } = require('../../micro_services/micro_service_apis_swile/app/controllers/swile/paymentLoteBonuses.controller');

const jobVerifyStatusPaymentSwile = new CronJob('0 0 * * * *', async () => {
  console.log("TESTE DE CRON")
  await verifyStatusPayment()
}, null, true, 'America/Sao_Paulo');

module.exports = {
  jobVerifyStatusPaymentSwile
};