// testarPushBoletos.js
const { verifyStatusPayment } = require('./app/controllers/swile/paymentLoteBonuses.controller');

(async () => {
  console.log("🚀 Iniciando teste manual do swilw...");
  await verifyStatusPayment();
  console.log("✅ Teste manual finalizado.");
})();
