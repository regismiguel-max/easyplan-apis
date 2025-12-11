/**
 * digital_saude/beneficiarios.controller.js
 * Versão: Híbrida TURBO (Banco local + Faturas remotas)
 * Paginação por contrato + Filtro de vigência recalculado em memória
 */

const db = require("../../../../../models");
const Beneficiario = db.beneficiariosDigital;
const axios = require("../../config/axios/axios.config.js");
const { Op } = require("sequelize");
const moment = require("moment-timezone");

/* =========================================================
 * CONFIGURAÇÕES
 * =======================================================*/
const GLOBAL_CONC_HTTP = 3;
const DELAY_ENTRE_CONTRATOS_MS = 1500;
const HTTP_RETRIES = 2;
const HTTP_RETRY_BASE_MS = 250;

/* =========================================================
 * Utils
 * =======================================================*/
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createLimiter(concurrency = 12) {
    let active = 0;
    const queue = [];
    const next = () => {
        if (active >= concurrency || queue.length === 0) return;
        active++;
        const { fn, resolve, reject } = queue.shift();
        Promise.resolve(fn()).then(resolve, reject).finally(() => {
            active--;
            next();
        });
    };
    return (fn) =>
        new Promise((resolve, reject) => {
            queue.push({ fn, resolve, reject });
            next();
        });
}

async function withRetry(fn, { retries = HTTP_RETRIES, baseMs = HTTP_RETRY_BASE_MS } = {}) {
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (err) {
            const status = err?.response?.status;
            const body = err?.response?.data;
            const message = typeof body === "string" ? body : body?.message || "";
            const isRateLimit401 = status === 401 && (message.includes("Rate Limit") || message.includes("Acesso Não Autorizado"));
            const retriable =
                isRateLimit401 ||
                status === 429 ||
                (status >= 500 && status < 600) ||
                err.code === "ETIMEDOUT" ||
                err.code === "ECONNRESET" ||
                (typeof err.message === "string" && err.message.includes("Timeout"));

            if (i < retries && retriable) {
                const backoff = isRateLimit401
                    ? 10_000
                    : baseMs * Math.pow(2, i) + Math.floor(Math.random() * baseMs);
                console.warn(`[withRetry] Falha (${status || "?"}) ${message}. Tentando novamente em ${(backoff / 1000).toFixed(1)}s...`);
                await sleep(backoff);
                continue;
            }
            throw err;
        }
    }
}

const globalLimit = createLimiter(GLOBAL_CONC_HTTP);

/* =========================================================
 * Circuit Breaker
 * =======================================================*/
const cb = new Map();
const CB_MAX_FAILS = 5;
const CB_WINDOW_MS = 60_000;
const CB_OPEN_MS = 30_000;
const isOpen = (url) => {
    const st = cb.get(url);
    return st && st.openedUntil && st.openedUntil > Date.now();
};
const onSuccess = (url) => cb.delete(url);
const onFailure = (url) => {
    const st = cb.get(url) || { fails: 0, ts: Date.now(), openedUntil: 0 };
    const within = Date.now() - st.ts < CB_WINDOW_MS;
    const fails = within ? st.fails + 1 : 1;
    const openedUntil = fails >= CB_MAX_FAILS ? Date.now() + CB_OPEN_MS : 0;
    cb.set(url, { fails, ts: Date.now(), openedUntil });
};

/* =========================================================
 * Helpers de API Digital Saúde
 * =======================================================*/
async function getArr(url) {
    if (isOpen(url)) throw new Error(`CircuitOpen: ${url}`);
    return globalLimit(() =>
        withRetry(async () => {
            try {
                const resp = await axios.https_digital.get(url);
                onSuccess(url);
                return Array.isArray(resp.data) ? resp.data : [];
            } catch (e) {
                onFailure(url);
                throw e;
            }
        })
    );
}

async function getLiquidadas(codigoContrato) {
    const url = `/fatura/procurarLiquidadasPorContrato?codigoContrato=${codigoContrato}`;
    if (isOpen(url)) return [];
    return globalLimit(() =>
        withRetry(async () => {
            try {
                const resp = await axios.https_digital.get(url, {
                    validateStatus: (s) => (s >= 200 && s < 300) || s === 400,
                });
                onSuccess(url);
                return resp.status === 400 ? [] : Array.isArray(resp.data) ? resp.data : [];
            } catch (e) {
                onFailure(url);
                throw e;
            }
        })
    );
}

/* =========================================================
 * Helpers de domínio
 * =======================================================*/
function sortFaturasPorVencimentoDesc(faturas = []) {
    const toMillis = (f) => {
        const pick = f?.dataFatura || f?.dataVencimento || f?.dataVencimentoCobranca;
        if (pick) {
            const m = moment(pick, "DD/MM/YYYY", true);
            if (m.isValid()) return m.valueOf();
        }
        if (f?.ano && f?.mes) {
            const y = Number(f.ano) || 0;
            const mm = (Number(f.mes) || 1) - 1;
            return new Date(y, mm, 1).getTime();
        }
        return -Infinity;
    };
    faturas.sort((a, b) => toMillis(b) - toMillis(a));
    return faturas;
}

function agruparPorContrato(beneficiarios) {
    const map = new Map();
    for (const b of beneficiarios) {
        if (!b.codigo_do_contrato) continue;
        if (!map.has(b.codigo_do_contrato)) map.set(b.codigo_do_contrato, []);
        map.get(b.codigo_do_contrato).push(b);
    }
    return Array.from(map.entries()).map(([codigo, list]) => ({
        codigo,
        beneficiarioList: list,
        entidade: list[0]?.grupo || null,
    }));
}

const buscarTitular = (list = []) =>
    list.find(b => b.tipo_de_beneficiario?.toLowerCase() === "titular") || list[0] || null;
const buscarDependentes = (list = []) =>
    list.filter(b => b.tipo_de_beneficiario?.toLowerCase() !== "titular");

/* =========================================================
 * Controller principal
 * =======================================================*/
exports.buscarBeneficiarios = async (req, res) => {
    const __t0 = Date.now();
    try {
        const {
            cpf,
            operadora,
            convenio,
            plano,
            vigencia,
            vigenciaInicio,
            vigenciaFim,
            tipo_de_beneficiario,
            status_do_beneficiario,
            fatura,
            page = 1,
            limit = 50,
        } = req.query;

        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 50;
        const offset = (pageNum - 1) * limitNum;

        /* ==============================
         * Filtros dinâmicos
         * ==============================*/
        const where = {};
        if (cpf) where.cpf = { [Op.like]: `%${cpf.replace(/\D/g, "")}%` };
        if (operadora) where.operadora = { [Op.like]: `%${operadora}%` };
        if (convenio) where.convenio = { [Op.like]: `%${convenio}%` };
        if (plano) where.plano = { [Op.like]: `%${plano}%` };
        if (tipo_de_beneficiario) where.tipo_de_beneficiario = tipo_de_beneficiario;
        if (status_do_beneficiario) where.status_do_beneficiario = status_do_beneficiario;
        if (vigencia) where.vigencia = { [Op.like]: `%${vigencia}%` };

        /* ==============================
         * Paginação por contrato (pré)
         * ==============================*/
        const contratosUnicos = await Beneficiario.findAll({
            where,
            attributes: ["codigo_do_contrato"],
            group: ["codigo_do_contrato"],
            raw: true,
        });

        const codigos = contratosUnicos.map(c => c.codigo_do_contrato);
        let beneficiarios = await Beneficiario.findAll({
            where: { codigo_do_contrato: codigos },
            raw: true,
        });

        /* ==============================
         * Filtro de vigência em memória
         * ==============================*/
        if (!vigencia && vigenciaInicio && vigenciaFim) {
            const inicio = moment(vigenciaInicio, "DD/MM/YYYY", true);
            const fim = moment(vigenciaFim, "DD/MM/YYYY", true);

            if (inicio.isValid() && fim.isValid()) {
                beneficiarios = beneficiarios.filter(b => {
                    const data = moment(b.vigencia, "DD/MM/YYYY", true);
                    return data.isValid() && data.isBetween(inicio, fim, "day", "[]");
                });
            }
        }

        /* ==============================
         * Recalcula paginação após filtro
         * ==============================*/
        // 🔹 Ordenação fixa antes de agrupar/paginar
        // beneficiarios.sort((a, b) => {
        //     // 1️⃣ Ordenar por vigência (decrescente)
        //     const dateA = moment(a.vigencia, "DD/MM/YYYY", true);
        //     const dateB = moment(b.vigencia, "DD/MM/YYYY", true);
        //     const diff = (dateB.isValid() ? dateB.valueOf() : 0) - (dateA.isValid() ? dateA.valueOf() : 0);
        //     if (diff !== 0) return diff;

        //     // 2️⃣ Se mesma vigência, ordenar por nome do titular (alfabético)
        //     const nameA = (a.nome_do_beneficiario || "").toLowerCase();
        //     const nameB = (b.nome_do_beneficiario || "").toLowerCase();
        //     return nameA.localeCompare(nameB);
        // });

        beneficiarios.sort((a, b) => {
            // 1️⃣ Ordenar por vigência (crescente)
            const dateA = moment(a.vigencia, "DD/MM/YYYY", true);
            const dateB = moment(b.vigencia, "DD/MM/YYYY", true);
            const diff = (dateA.isValid() ? dateA.valueOf() : 0) - (dateB.isValid() ? dateB.valueOf() : 0);
            if (diff !== 0) return diff;

            // 2️⃣ Se mesma vigência, ordenar por nome do titular (alfabético)
            const nameA = (a.nome_do_beneficiario || "").toLowerCase();
            const nameB = (b.nome_do_beneficiario || "").toLowerCase();
            return nameA.localeCompare(nameB);
        });

        const contratosFiltrados = agruparPorContrato(beneficiarios);
        const totalContratosFiltrados = contratosFiltrados.length;
        const totalPages = Math.ceil(totalContratosFiltrados / limitNum);
        const contratos = contratosFiltrados.slice(offset, offset + limitNum);
        const contracts = [];

        if (!contratos.length) {
            res.set("X-Perf-ms", String(Date.now() - __t0));
            return res.send({
                contratos: [],
                message: "Nenhum beneficiário encontrado.",
                sucesso: true,
                paginacao: { total: 0, page: pageNum, limit: limitNum, pages: 0 },
            });
        }

        /* ==============================
         * Processa cada contrato
         * ==============================*/
        for (const [idx, contrato] of contratos.entries()) {
            try {
                const codigoContrato = contrato?.codigo || null;
                const titular = buscarTitular(contrato?.beneficiarioList || []);
                const dependentes = buscarDependentes(contrato?.beneficiarioList || []);
                const faturas = [];

                if (fatura === "true" && codigoContrato && titular) {
                    await sleep(DELAY_ENTRE_CONTRATOS_MS);

                    const [
                        emitidasArr,
                        pagasArr,
                        liquidadasArr,
                        vencidasArr,
                        baixadasArr,
                        pagasNoCartaoArr,
                        reemitidasArr,
                    ] = await Promise.all([
                        getArr(`/fatura/procurarPorContrato?codigoContrato=${codigoContrato}&idStatusFatura=2&pix=1`),
                        getArr(`/fatura/procurarPorContrato?codigoContrato=${codigoContrato}&idStatusFatura=3&pix=1`),
                        getLiquidadas(codigoContrato),
                        getArr(`/fatura/procurarPorContrato?codigoContrato=${codigoContrato}&idStatusFatura=4&pix=1`),
                        getArr(`/fatura/procurarPorContrato?codigoContrato=${codigoContrato}&idStatusFatura=6&pix=1`),
                        getArr(`/fatura/procurarPorContrato?codigoContrato=${codigoContrato}&idStatusFatura=7&pix=1`),
                        getArr(`/fatura/procurarPorContrato?codigoContrato=${codigoContrato}&idStatusFatura=9&pix=1`),
                    ]);

                    faturas.push(
                        ...emitidasArr,
                        ...pagasArr,
                        ...liquidadasArr,
                        ...vencidasArr,
                        ...baixadasArr,
                        ...pagasNoCartaoArr,
                        ...reemitidasArr
                    );
                    sortFaturasPorVencimentoDesc(faturas);
                }

                contracts.push({
                    codigo: contrato?.codigo ?? null,
                    dependentes,
                    entidade: contrato?.entidade ?? null,
                    faturas,
                    operadora: { nome: titular?.operadora ?? null },
                    plano: { nome: titular?.plano ?? null, acomodacao: titular?.acomodacao ?? null },
                    produto: { nome: titular?.produto ?? null },
                    responsavel: {
                        nome: titular?.nome_responsavel_financeiro ?? null,
                        cpf: titular?.cpf_responsavel ?? null,
                    },
                    statusContrato: titular?.status_do_beneficiario ?? null,
                    titular,
                    vigencia: titular?.vigencia ?? null,
                    modalidade:
                        titular?.subestipulante?.trim()?.toLowerCase().includes("empresas")
                            ? "Empresarial"
                            : "Adesão",
                });
            } catch (err) {
                console.error(`Erro ao processar contrato ${contrato?.codigo || "sem código"}:`, err.message);
            }
        }

        /* ==============================
         * Retorno final
         * ==============================*/
        res.set("X-Perf-ms", String(Date.now() - __t0));
        return res.send({
            contratos: contracts,
            message: "Lista de contratos e faturas encontrados.",
            sucesso: true,
            paginacao: {
                total: totalContratosFiltrados,
                page: pageNum,
                limit: limitNum,
                pages: totalPages,
                retornados: contratos.length,
            },
        });
    } catch (err) {
        console.error("Erro ao buscar beneficiários:", err);
        res.set("X-Perf-ms", String(Date.now() - __t0));
        return res.status(500).send({ message: err.message, sucesso: false });
    }
};
