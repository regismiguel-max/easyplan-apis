const { CronJob } = require("cron");
const axios = require("axios");
const https = require("https");

const TZ = "America/Sao_Paulo";
const DATA_INICIO_FIXA = "2025-09-01";

// se o 3088 tiver HTTPS self-signed internamente, isto evita erro de certificado
const relaxAgent = new https.Agent({ rejectUnauthorized: false });

function getDataFimSaoPauloMaisUm() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const y = Number(parts.find(p => p.type === "year").value);
    const m = Number(parts.find(p => p.type === "month").value);
    const d = Number(parts.find(p => p.type === "day").value);
    const zoned = new Date(Date.UTC(y, m - 1, d));
    zoned.setUTCDate(zoned.getUTCDate() + 1);
    const yy = zoned.getUTCFullYear();
    const mm = String(zoned.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(zoned.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

async function gerarRanking() {
    const fim = getDataFimSaoPauloMaisUm();
    const url = `https://apis.easyplan.com.br:3088/api/ranking/gerar?inicio=${DATA_INICIO_FIXA}&fim=${fim}`;

    try {
        console.log(`⏩ [${new Date().toISOString()}] POST ${url}`);
        const { data, status } = await axios.post(url, null, {
            timeout: 60000,
            httpsAgent: relaxAgent,
            // headers: { 'Content-Type': 'application/json' }
        });
        console.log(`✅ Ranking OK (HTTP ${status})`, data);
        return data;
    } catch (err) {
        const http = err?.response?.status;
        const body = err?.response?.data;
        console.error("❌ Erro ao gerar ranking:", http || err.code || err.message, body || "");
        throw err;
    }
}

const jobRanking = new CronJob(
    "0 0 0,7,9,14,19 * * *",
    async () => {
        console.log("⏰ Disparo do Cron Ranking...");
        await gerarRanking();
    },
    null,
    true, // inicia automaticamente
    TZ
);

try {
    console.log("📆 Próximas execuções:", jobRanking.nextDates(5).map(d => d.toString()));
} catch (e) {
    console.warn("⚠️ Não foi possível calcular próximas datas:", e?.message);
}

module.exports = { jobRanking, gerarRanking };