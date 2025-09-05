// cron/cronRanking.js
const { CronJob } = require("cron");
const axios = require("axios");

console.log("📅 CronRanking carregado e jobs prontos para execução.");

// Função que monta URL e chama API
async function gerarRanking() {
    try {
        const hoje = new Date();
        hoje.setDate(hoje.getDate() + 1); // Data de amanhã

        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, "0");
        const dia = String(hoje.getDate()).padStart(2, "0");

        const dataInicio = "2025-09-01";
        const dataFim = `${ano}-${mes}-${dia}`;

        const url = `https://apis.easyplan.com.br:3088/api/ranking/gerar?inicio=${dataInicio}&fim=${dataFim}`;

        console.log(`🚀 Chamando API Ranking: ${url}`);
        const response = await axios.get(url);
        console.log("✅ Ranking gerado com sucesso:", response.data);
    } catch (error) {
        console.error("❌ Erro ao gerar ranking:", error.message);
    }
}

// Rodar todos os dias às 00:00, 08:00, 14:00 e 18:00
const jobRanking = new CronJob(
    "0 0 0,8,14,19 * * *",
    async () => {
        console.log("⏰ Executando Cron Ranking...");
        await gerarRanking();
    },
    null,
    true,
    "America/Sao_Paulo"
);

module.exports = {
    jobRanking,
};
