// testarPushBoletos.js
const { verifyStatusPayment } = require('./app/controllers/swile/paymentLoteBonuses.controller');

(async () => {
  console.log("🚀 Iniciando teste manual do swile...");
  await verifyStatusPayment();
  console.log("✅ Teste manual finalizado.");
})();
