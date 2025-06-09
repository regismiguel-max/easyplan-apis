const { CronJob } = require('cron');
const { dispararPushBoletos } = require('../../micro_services/micro_service_apis_clientes/app/controllers/push/push_logs.controller');

console.log("📅 CronBoletos carregado e jobs prontos para execução.");

// Agendar para 08:00, 12:00 e 20:00
const jobHorariosFixos = new CronJob('0 0 8,12,14,18,20 * * *', async () => {
  console.log('⏰ Executando dispararPushBoletos (08:00, 12:00 ou 20:00)...');
  await dispararPushBoletos();
}, null, true, 'America/Sao_Paulo');

// const jobHorariosFixos = new CronJob('*/1 * * * *', async () => {
//   console.log("🕒 Cronjob iniciou execução em:", new Date().toString());
//   const now = new Date();
//   console.log("🕒 Cronjob iniciou execução em:", now.toString());
// }, null, true, 'America/Sao_Paulo');

// Agendar para exatamente 17:30
const jobDezesseteTrinta = new CronJob('0 30 17,21,22 * * *', async () => {
  console.log('⏰ Executando dispararPushBoletos (17:30)...');
  await dispararPushBoletos();
}, null, true, 'America/Sao_Paulo');

module.exports = {
  jobHorariosFixos,
  jobDezesseteTrinta
};
