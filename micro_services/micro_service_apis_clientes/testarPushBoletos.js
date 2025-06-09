// testarPushBoletos.js
const { dispararPushBoletos } = require('./app/controllers/push/push_logs.controller');

(async () => {
  console.log("🚀 Iniciando teste manual do disparo de pushs...");
  await dispararPushBoletos();
  console.log("✅ Teste manual finalizado.");
})();
