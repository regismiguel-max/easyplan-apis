const { CronJob } = require("cron");
const axios = require("axios");
const https = require("https");
const db = require("../../models"); // <- ajuste o caminho p/ seu projeto

const relaxAgent = new https.Agent({ rejectUnauthorized: false });

/* ========================= Utils ========================= */
const normDigits = (s) => String(s || "").replace(/\D+/g, "");

// 1) resolver a data na timezone America/Sao_Paulo
function nowInSaoPaulo() {
    // cria um Date "equivalente" à hora de SP sem depender do TZ do host
    const isoSP = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo', hour12: false }).replace(' ', 'T');
    return new Date(isoSP);
}

// Respeita sua janela: 26/out -> 2025-11; >26/nov -> 2025-12; >26/dez -> 2026-01; antes de 26/out -> 2025-10
function resolveVigenciaMonth(now = nowInSaoPaulo()) {
    const y = 2025;
    const d1 = new Date(y, 9, 26);   // 26/10/2025 (mês 9 = outubro, zero-based)
    const d2 = new Date(y, 10, 26);  // 26/11/2025
    const d3 = new Date(y, 11, 26);  // 26/12/2025
    if (now < d1) return "2025-10";
    if (now >= d1 && now <= d2) return "2025-11";
    if (now > d2 && now <= d3) return "2025-12";
    return "2026-01";
}

// Extrai CPF do item do ranking (ajuste conforme seu payload real)
function getCpfFromTopRow(row) {
    // tente múltiplos campos comuns no seu ranking
    const possible = [row?.corretor_cpf, row?.cpf, row?.documento, row?.cpfProdutor, row?.cpf_corretor];
    const cpf = possible.find(Boolean);
    return normDigits(cpf);
}

// Quebra o array em grupos
function splitGroups(top = []) {
    const g = { top1: [], top2: [], top3: [], top4_10: [], top11_20: [], top21_60: [] };
    if (!Array.isArray(top) || top.length === 0) return g;

    // Ordena pelo rank_confirmadas (numérico), com tolerância a strings ou campos ausentes
    const ranked = [...top].sort((a, b) => {
        const pa = Number(a?.rank_confirmadas ?? a?.posicao ?? a?.rank ?? Infinity);
        const pb = Number(b?.rank_confirmadas ?? b?.posicao ?? b?.rank ?? Infinity);
        return pa - pb;
    });

    if (ranked[0]) g.top1 = [ranked[0]];
    if (ranked[1]) g.top2 = [ranked[1]];
    if (ranked[2]) g.top3 = [ranked[2]];
    if (ranked.length > 3) g.top4_10 = ranked.slice(3, 10);
    if (ranked.length > 10) g.top11_20 = ranked.slice(10, 20);
    if (ranked.length > 20) g.top21_60 = ranked.slice(20, 60);
    return g;
}

// Busca whatsapp pelo CPF: produtores -> contato_ID -> produtores_contato.whatsapp
async function findWhatsappByCpf(cpf) {
    const Produtores = db.produtores;
    const Contato = db.produtores_contatos;

    const prod = await Produtores.findOne({
        where: { cpf: normDigits(cpf) },
        attributes: ["id", "nome", "contato_ID"],
        raw: true,
    });

    if (!prod?.contato_ID) return null;

    const contato = await Contato.findByPk(prod.contato_ID, {
        attributes: ["whatsapp", "telefone", "email"],
        raw: true,
    });

    const whats = normDigits(contato?.whatsapp);
    return whats || null;
}

// Envio de WhatsApp por grupo (stubs) — plugue aqui seu serviço real
async function sendWhatsAppTop1(items) { return sendWhatsAppByGroup("TOP 1", items); }
async function sendWhatsAppTop2(items) { return sendWhatsAppByGroup("TOP 2", items); }
async function sendWhatsAppTop3(items) { return sendWhatsAppByGroup("TOP 3", items); }
async function sendWhatsApp4a10(items) { return sendWhatsAppByGroup("TOP 4–10", items); }
async function sendWhatsApp11a20(items) { return sendWhatsAppByGroup("TOP 11–20", items); }
async function sendWhatsApp21a60(items) { return sendWhatsAppByGroup("TOP 21–60", items); }

// Modelo de mensagem (ajuste seu copy/variáveis)
function buildMessage(groupLabel) {
    if (groupLabel === 'TOP 1') {
        return `⚔️ *Batalha Easy!* ⚔️
Parabéns, guerreiro(a)! Você está no *1º lugar* e liderando a tropa! 🏆🔥
Mas cuidado: a guerra está acirrada e os rivais estão na sua cola. Não é hora de relaxar… é hora de atacar ainda mais forte! ⚡
        `
    }
    if (groupLabel == 'TOP 2') {
        return `⚔️ *Batalha Easy!* ⚔️
Você está no *2º lugar* – o trono está logo ali 👑🔥
Faltam poucas vidas para tomar o topo e mostrar que você é o verdadeiro líder desta batalha! Avance sem piedade! ⚔️
`
    }
    if (groupLabel == 'TOP 3') {
        return `⚔️ *Batalha Easy!* ⚔️
Você está no *3º lugar* – já sente o cheiro da vitória? 👀🔥
O 1º lugar não está tão longe… uma arrancada agora e você vira a lenda desta batalha! Não perca o ritmo, a glória te espera! ⚡
`
    }
    if (groupLabel == 'TOP 4–10') {
        return `⚔️ *Batalha Easy!* ⚔️
Você já está no *Top 10*, guerreiro(a)! 🔥
O pódio está logo acima, e quem chegar mais forte leva a glória. Mostre sua coragem e lute com garra – ainda dá tempo de virar essa guerra! ⚔️
`
    }
    if (groupLabel == 'TOP 11–20') {
        return `⚔️ *Batalha Easy!* ⚔️
Você está no *Top 20* – mas a batalha só começa de verdade no Top 10! 🚀
Com algumas vidas a mais, você derruba rivais e entra para a elite dos guerreiros. Hora de acelerar, o campo de guerra te espera! ⚔️🔥
`
    }
    if (groupLabel == 'TOP 21–60') {
        return `⚔️ *Batalha Easy!* ⚔️
Você está no campo de batalha, mas ainda distante do ranking principal… 🛡️
Agora é a hora da virada! Quem arrisca, conquista! Uma sequência de vitórias pode colocar seu nome entre os heróis que fazem a diferença! ⚡
`
    }
}

// Aqui centralizamos o disparo (troque pelo seu serviço/SDK/HTTP)
async function sendWhatsAppByGroup(groupLabel, items) {
    const API_URL = "https://afinidade.atenderbem.com/int/enqueueMessageToSend";
    let sent = 0, skipped = 0, errors = 0;

    for (const row of items) {
        try {
            const cpf = getCpfFromTopRow(row);
            if (!cpf) { skipped++; continue; }

            const whatsappNumberRaw = await findWhatsappByCpf(cpf);
            const whatsappNumber = normDigits(whatsappNumberRaw);
            if (!whatsappNumber || whatsappNumber.length < 10) { skipped++; continue; }

            const message = (buildMessage(groupLabel) || "").trim();

            await axios.post(API_URL, {
                queueId: 20,
                apiKey: "9c35e41ff6224efba0f52ba47ecb51b9",
                number: whatsappNumber,
                country: "+55",
                text: message,
            }, { timeout: 15000, httpsAgent: relaxAgent });
            console.log(`➡️  [${groupLabel}] Enviar para ${whatsappNumber} | CPF ${cpf}`);

            sent++;
            // throttling leve para evitar ban/limites, ajuste
            await new Promise(r => setTimeout(r, 250));
        } catch (e) {
            console.error(`❌ Falha envio [${groupLabel}]:`, e?.response?.status || e?.code || e?.message);
            errors++;
        }
    }

    console.log(`✅ Grupo ${groupLabel}: enviados=${sent}, sem_whatsapp=${skipped}, erros=${errors}`);
}

/* ========================= Core ========================= */
async function loadRankMes(vigenciaMonth) {
    const url = `https://apis.easyplan.com.br:3088/api/ranking/por-vigencia?janela=MES&vigencia=${vigenciaMonth}&escopo=nacional&limit=60&incluirValor=false`;

    try {
        console.log(`⏩ [${new Date().toISOString()}] POST ${url}`);
        const { data } = await axios.get(url, null, {
            timeout: 60000,
            httpsAgent: relaxAgent,
        });

        if (!data?.top || !Array.isArray(data.top) || data.top.length === 0) {
            console.warn("⚠️ Nenhum dado 'top' retornado.");
            return;
        }

        const groups = splitGroups(data.top);

        // Disparos por grupo (cada um com sua função dedicada)
        if (groups.top1.length) await sendWhatsAppTop1(groups.top1);
        if (groups.top2.length) await sendWhatsAppTop2(groups.top2);
        if (groups.top3.length) await sendWhatsAppTop3(groups.top3);
        if (groups.top4_10.length) await sendWhatsApp4a10(groups.top4_10);
        if (groups.top11_20.length) await sendWhatsApp11a20(groups.top11_20);
        if (groups.top21_60.length) await sendWhatsApp21a60(groups.top21_60);

        console.log("🎉 Disparos concluídos.");
        const numeros = ['54992389702', '61993598991', '61981443333'];

        await Promise.all(
            numeros.map((element) =>
                axios.post(
                    'https://afinidade.atenderbem.com/int/enqueueMessageToSend',
                    {
                        queueId: 20,
                        apiKey: "9c35e41ff6224efba0f52ba47ecb51b9", // <— use env
                        number: element,
                        country: "+55",
                        text: `📢 Olá, o ranking individual de cada produtor foi enviado com sucesso!`,
                    },
                    { timeout: 15000, httpsAgent: relaxAgent }
                ).catch(err => {
                    console.error("❌ Falha notificação final:", err?.response?.status || err?.code || err?.message);
                })
            )
        );
    } catch (err) {
        const http = err?.response?.status;
        const body = err?.response?.data;
        console.error("❌ Erro ao gerar ranking:", http || err.code || err.message, body || "");
        throw err;
    }
}

/* ========================= Execução direta e CRON ========================= */
// Execução imediata (útil para testes locais)
// async function teste() {
//     const month = resolveVigenciaMonth(new Date());
//     await loadRankMes(month);
// }

// CRON: todo dia às 09:00 na timezone de São Paulo
const jobRankingWhatsApp = new CronJob(
    "0 30 9 * * *",
    async () => {
        try {
            const month = resolveVigenciaMonth(nowInSaoPaulo());
            console.log(`🗓️  Rodando job Ranking WhatsApp | vigencia=${month}`);
            await loadRankMes(month);
        } catch (e) {
            console.error("❌ Erro no job Ranking WhatsApp:", e?.message || e);
        }
    },
    null,
    true,
    "America/Sao_Paulo"
);

module.exports = { jobRankingWhatsApp, loadRankMes, resolveVigenciaMonth };
