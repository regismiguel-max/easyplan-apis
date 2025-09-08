// cron/cronRanking.js
const { CronJob } = require("cron");
const axios = require("axios");

const TZ = "America/Sao_Paulo";
const DATA_INICIO_FIXA = "2025-09-01";

console.log("📅 CronRanking carregado e aguardando próximas execuções...");

// pega a data "agora" no fuso de SP e soma +1 dia, retornando YYYY-MM-DD
function getDataFimSaoPauloMaisUm() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const y = Number(parts.find(p => p.type === "year").value);
    const m = Number(parts.find(p => p.type === "month").value);
    const d = Number(parts.find(p => p.type === "day").value);

    // cria um Date em UTC mas com os componentes do fuso (evita drift)
    const zoned = new Date(Date.UTC(y, m - 1, d));
    zoned.setUTCDate(zoned.getUTCDate() + 1); // +1 dia

    const yy = zoned.getUTCFullYear();
    const mm = String(zoned.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(zoned.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

async function gerarRanking() {
    try {
        const dataFim = getDataFimSaoPauloMaisUm();
        const url = `https://apis.easyplan.com.br:3088/api/ranking/gerar?inicio=${DATA_INICIO_FIXA}&fim=${dataFim}`;

        console.log(`⏩ [${new Date().toISOString()}] Chamando: ${url}`);
        const { data, status } = await axios.get(url, { timeout: 60000 });
        console.log(`✅ Ranking OK (HTTP ${status})`, data);
    } catch (err) {
        const http = err?.response?.status;
        const body = err?.response?.data;
        console.error("❌ Erro ao gerar ranking:", http || err.code || err.message, body || "");
    }
}

// Expressão CRON correta (6 campos): seg min hora diaDoMes mes diaDaSemana
// 0 0 0,8,14,18 * *  -> às 00:00, 08:00, 14:00 e 18:00 todos os dias
const jobRanking = new CronJob(
    "0 0 0,8,10,12,16,18 * * *",
    async () => {
        console.log("⏰ Disparo do Cron Ranking...");
        await gerarRanking();
    },
    null,
    false,              // start manual para logar .nextDates() antes
    TZ,
    null,
    false               // runOnInit = false (mude para true se quiser testar no boot)
);

// diagnóstico: log das próximas execuções e iniciar
try {
    console.log("📆 Próximas execuções:", jobRanking.nextDates(4).map(d => d.toString()));
} catch (e) {
    console.warn("⚠️ Não foi possível calcular próximas datas:", e?.message);
}

module.exports = { jobRanking, gerarRanking };