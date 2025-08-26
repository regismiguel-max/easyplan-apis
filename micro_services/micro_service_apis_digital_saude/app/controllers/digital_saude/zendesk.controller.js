/**
 * digital_saude/zendesk.controller.js
 * Versão: Híbrida TURBO (global limiter + retries + circuit breaker + full history)
 */

const axios = require("../../config/axios/axios.config.js");
const moment = require("moment-timezone");

/* =========================================================
 * CONFIGURAÇÕES (edite aqui!)
 * Também aceitam override via ENV:
 *   CONC_CONTRATOS, GLOBAL_CONC_HTTP, HTTP_TIMEOUT_MS,
 *   HTTP_RETRIES, HTTP_RETRY_BASE_MS, LOG_LATENCY
 * =======================================================*/
const CONC_CONTRATOS = Number(process.env.CONC_CONTRATOS) || 6;     // contratos em paralelo
const GLOBAL_CONC_HTTP = Number(process.env.GLOBAL_CONC_HTTP) || 12;    // chamadas HTTP simultâneas (total)
const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS) || 10000; // timeout por request axios
const HTTP_RETRIES = Number(process.env.HTTP_RETRIES) || 2;     // retries p/ 429/5xx/timeout
const HTTP_RETRY_BASE_MS = Number(process.env.HTTP_RETRY_BASE_MS) || 250;   // base do backoff exponencial
const LOG_LATENCY = (process.env.LOG_LATENCY === '1') || false; // log de latência por URL

/* =========================================================
 * Interceptors de latência (opcional) na instância DIGITAL
 * =======================================================*/
try {
    if (axios?.https_digital && LOG_LATENCY) {
        axios.https_digital.interceptors.request.use(cfg => {
            cfg.metadata = { start: Date.now(), url: cfg.url };
            return cfg;
        });
        axios.https_digital.interceptors.response.use(
            res => {
                const t = Date.now() - (res.config.metadata?.start || Date.now());
                console.info(`[digital] ${res.config.metadata?.url} -> ${res.status} in ${t}ms`);
                return res;
            },
            err => {
                const cfg = err.config || {};
                const t = Date.now() - (cfg.metadata?.start || Date.now());
                console.error(`[digital] ${cfg.metadata?.url} -> ERROR in ${t}ms: ${err.message}`);
                return Promise.reject(err);
            }
        );
    }
} catch (_) { /* silencioso */ }

/* =========================================================
 * Utils: sleep, limiter, retry, concurrentMap
 * =======================================================*/
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function createLimiter(concurrency = 12) {
    let active = 0;
    const queue = [];
    const next = () => {
        if (active >= concurrency || queue.length === 0) return;
        active++;
        const { fn, resolve, reject } = queue.shift();
        Promise.resolve(fn()).then(resolve, reject).finally(() => { active--; next(); });
    };
    return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}

async function withRetry(fn, { retries = HTTP_RETRIES, baseMs = HTTP_RETRY_BASE_MS } = {}) {
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (err) {
            const status = err?.response?.status;
            const retriable =
                status === 429 ||
                (status >= 500 && status < 600) ||
                err.code === 'ETIMEDOUT' ||
                err.code === 'ECONNRESET' ||
                (typeof err.message === 'string' && err.message.includes('Timeout'));

            // Respeita Retry-After (segundos), se existir
            const retryAfter = Number(err?.response?.headers?.['retry-after']);

            if (i < retries && retriable) {
                const backoff = Number.isFinite(retryAfter)
                    ? retryAfter * 1000
                    : baseMs * Math.pow(2, i) + Math.floor(Math.random() * baseMs);
                await sleep(backoff);
                continue;
            }
            throw err;
        }
    }
}

async function concurrentMap(items, concurrency, mapper) {
    const limit = createLimiter(concurrency);
    return Promise.all(items.map((item, idx) => limit(() => mapper(item, idx))));
}

// Limite GLOBAL de HTTP
const globalLimit = createLimiter(GLOBAL_CONC_HTTP);

/* =========================================================
 * Circuit Breaker simples por URL
 * =======================================================*/
const cb = new Map(); // url -> { fails, ts, openedUntil }
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
    const within = (Date.now() - st.ts) < CB_WINDOW_MS;
    const fails = within ? st.fails + 1 : 1;
    const openedUntil = fails >= CB_MAX_FAILS ? Date.now() + CB_OPEN_MS : 0;
    cb.set(url, { fails, ts: Date.now(), openedUntil });
};

/* =========================================================
 * Helpers de API
 * =======================================================*/
// Demais endpoints (2xx ok; erro propaga)
async function getArr(url) {
    if (isOpen(url)) throw new Error(`CircuitOpen: ${url}`);
    return globalLimit(() => withRetry(async () => {
        try {
            const resp = await axios.https_digital.get(url);
            onSuccess(url);
            return Array.isArray(resp.data) ? resp.data : [];
        } catch (e) {
            onFailure(url);
            throw e;
        }
    }));
}

// Liquidadas: 400 = lista vazia (degradação suave se breaker aberto)
async function getLiquidadas(codigoContrato) {
    const url = `/fatura/procurarLiquidadasPorContrato?codigoContrato=${codigoContrato}`;
    if (isOpen(url)) return []; // degrade suave só aqui
    return globalLimit(() => withRetry(async () => {
        try {
            const resp = await axios.https_digital.get(url, {
                validateStatus: s => (s >= 200 && s < 300) || s === 400
            });
            onSuccess(url);
            return resp.status === 400 ? [] : (Array.isArray(resp.data) ? resp.data : []);
        } catch (e) {
            onFailure(url);
            throw e;
        }
    }));
}

/* =========================================================
 * Helpers de domínio
 * =======================================================*/
const joinPhone = (ddd, num) => (ddd || num) ? `${ddd || ''}${num || ''}` : null;

function calcularIdade(dataNascimento) {
    if (!dataNascimento) return null;
    const data = moment(dataNascimento, "DD/MM/YYYY", true);
    if (!data.isValid()) return null;
    return moment().diff(data, "years").toString();
}

// Ordena faturas em ordem DESC pela prioridade:
// dataFatura > dataVencimento > dataVencimentoCobranca
function sortFaturasPorVencimentoDesc(faturas = []) {
    const toMillis = (f) => {
        const pick =
            f?.dataFatura ||
            f?.dataVencimento ||
            f?.dataVencimentoCobranca;

        if (pick) {
            const m = moment(pick, "DD/MM/YYYY", true);
            if (m.isValid()) return m.valueOf();
        }

        // fallback: quando só vier ano/mes
        if (f?.ano && f?.mes) {
            const y = Number(f.ano) || 0;
            const mm = (Number(f.mes) || 1) - 1; // 0-based
            // usa dia 1 como referência
            return new Date(y, mm, 1).getTime();
        }

        // sem data -> manda pro final
        return -Infinity;
    };

    faturas.sort((a, b) => {
        const kb = toMillis(b);
        const ka = toMillis(a);
        if (kb !== ka) return kb - ka; // DESC

        // desempates opcionais
        const nb = Number(b?.numero) || 0;
        const na = Number(a?.numero) || 0;
        if (nb !== na) return nb - na; // DESC por número

        const cb = String(b?.codigo ?? "");
        const ca = String(a?.codigo ?? "");
        return ca.localeCompare(cb); // ASC por código
    });

    return faturas;
}

function buscarDependentes(beneficiarios = []) {
    const out = [];
    for (const beneficiario of beneficiarios) {
        if (beneficiario?.tipoBeneficiario?.nome !== "Titular") {
            out.push({
                cpf: beneficiario.cpf ?? null,
                nome: beneficiario.nome ?? null,
                carteirinha: beneficiario.marcaOptica ?? null,
                dataNascimento: beneficiario.dataNascimento ?? null,
                idade: calcularIdade(beneficiario.dataNascimento),
                email: beneficiario.email ?? null,
                celular: joinPhone(beneficiario.dddCelular, beneficiario.celular),
                telefone: joinPhone(beneficiario.dddTelefone, beneficiario.telefone),
                cep: beneficiario.cep ?? null,
                uf: beneficiario.uf ?? null,
                cidade: beneficiario.municipio ?? null,
                bairro: beneficiario.bairro ?? null,
                endereco: beneficiario.endereco ?? null,
                numero: beneficiario.numero ?? null,
                complemento: beneficiario.complemento ?? null,
                sexo: beneficiario.sexo?.nome ?? null,
                estadoCivil: beneficiario.estadoCivil?.nome ?? null,
                status: beneficiario.statusBeneficiario?.nome ?? null,
                dataVigencia: beneficiario.dataVigencia ?? null
            });
        }
    }
    return out;
}

function buscarTitular(beneficiarios = []) {
    let titular = null;
    for (const beneficiario of beneficiarios) {
        if (beneficiario?.tipoBeneficiario?.nome === "Titular") {
            titular = {
                cpf: beneficiario.cpf ?? null,
                nome: beneficiario.nome ?? null,
                carteirinha: beneficiario.marcaOptica ?? null,
                dataNascimento: beneficiario.dataNascimento ?? null,
                idade: calcularIdade(beneficiario.dataNascimento),
                email: beneficiario.email ?? null,
                celular: joinPhone(beneficiario.dddCelular, beneficiario.celular),
                telefone: joinPhone(beneficiario.dddTelefone, beneficiario.telefone),
                cep: beneficiario.cep ?? null,
                uf: beneficiario.uf ?? null,
                cidade: beneficiario.municipio ?? null,
                bairro: beneficiario.bairro ?? null,
                endereco: beneficiario.endereco ?? null,
                numero: beneficiario.numero ?? null,
                complemento: beneficiario.complemento ?? null,
                sexo: beneficiario.sexo?.nome ?? null,
                estadoCivil: beneficiario.estadoCivil?.nome ?? null,
                status: beneficiario.statusBeneficiario?.nome ?? null,
                dataVigencia: beneficiario.dataVigencia ?? null
            };
            break;
        }
    }
    return titular || {};
}

/* =========================================================
 * Controller
 * =======================================================*/
exports.buscarContratosFaturas = async (req, res) => {
    const __t0 = Date.now();
    try {
        const cpf = (req.params.cpf || '').replace(/\D/g, '');
        const { data: contratos } = await axios.https.get(`/contrato/procurarPorCpfTitular?cpf=${cpf}`);

        if (!Array.isArray(contratos) || contratos.length === 0) {
            res.set('X-Perf-ms', String(Date.now() - __t0));
            return res.send({ contratos: [], message: `Nenhum contrato encontrado para o CPF: ${req.params.cpf}`, sucesso: true });
        }

        const contracts = await concurrentMap(
            contratos,
            Math.min(CONC_CONTRATOS, contratos.length),
            async (contrato) => {
                const codigoContrato = contrato?.codigo || null;

                const titular = buscarTitular(contrato?.beneficiarioList || []);
                const dependentes = buscarDependentes(contrato?.beneficiarioList || []);

                let entidade = null;
                if (contrato?.entidade) {
                    entidade = {
                        codigo: contrato.entidade.codigo ?? null,
                        cnpj: contrato.entidade.cnpj ?? null,
                        razaoSocial: contrato.entidade.razaoSocial ?? null,
                        email: contrato.entidade.email ?? null,
                        celular: joinPhone(contrato.entidade.dddCelular, contrato.entidade.celular),
                        telefone: joinPhone(contrato.entidade.dddTelefone, contrato.entidade.telefone),
                        cep: contrato.entidade.cep ?? null,
                        uf: contrato.entidade.uf ?? null,
                        cidade: contrato.entidade.municipio ?? null,
                        bairro: contrato.entidade.bairro ?? null,
                        endereco: contrato.entidade.endereco ?? null,
                        numero: contrato.entidade.numero ?? null,
                        complemento: contrato.entidade.complemento ?? null,
                        status: contrato.entidade.statusEntidade?.nome ?? null,
                        dataVigencia: contrato.entidade.dataVigencia ?? null
                    };
                }

                const faturas = [];

                if (codigoContrato) {
                    const [
                        emitidasArr,
                        pagasArr,
                        liquidadasArr,   // 400 -> []
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

                    // === Mapas (iguais ao que você já usava) ===
                    if (Array.isArray(emitidasArr)) {
                        emitidasArr.forEach(fe => faturas.push({
                            codigo: fe.codigo ?? null,
                            dataFatura: fe.dataFatura ?? null,
                            dataPagamento: null,
                            dataVencimento: fe.dataVencimento ?? null,
                            dataVencimentoCobranca: fe.dataVencimentoCobranca ?? null,
                            linkFatura: fe.linkFatura ?? null,
                            linhaDigitavel: fe.linhaDigitavel ?? null,
                            linkReciboPagamento: null,
                            pixCopiaCola: fe.pixList?.length ? fe.pixList[0]?.brcode ?? null : null,
                            statusFatura: fe.statusFatura?.nome ?? null,
                            valorCobranca: fe.valorCobranca ?? null,
                            ano: fe.ano ?? null,
                            mes: fe.mes ?? null,
                            numero: fe.numero ?? null,
                        }));
                    }

                    if (Array.isArray(pagasArr)) {
                        pagasArr.forEach(fp => faturas.push({
                            codigo: fp.codigo ?? null,
                            dataFatura: fp.dataFatura ?? null,
                            dataPagamento: fp.dataPagamento ?? null,
                            dataVencimento: fp.dataVencimento ?? null,
                            dataVencimentoCobranca: fp.dataVencimentoCobranca ?? null,
                            linkFatura: null,
                            linhaDigitavel: null,
                            linkReciboPagamento: fp.linkReciboPagamento ?? null,
                            pixCopiaCola: null,
                            statusFatura: fp.statusFatura?.nome ?? null,
                            valorCobranca: fp.valorCobranca ?? null,
                            ano: fp.ano ?? null,
                            mes: fp.mes ?? null,
                            numero: fp.numero ?? null,
                        }));
                    }

                    if (Array.isArray(liquidadasArr)) {
                        liquidadasArr.forEach(fl => faturas.push({
                            codigo: fl.codigo ?? null,
                            dataFatura: fl.dataFatura ?? null,
                            dataPagamento: fl.dataPagamento ?? null,
                            dataVencimento: fl.dataVencimento ?? null,
                            dataVencimentoCobranca: fl.dataVencimentoCobranca ?? null,
                            linkFatura: null,
                            linhaDigitavel: null,
                            linkReciboPagamento: fl.linkReciboPagamento ?? null,
                            pixCopiaCola: null,
                            statusFatura: fl.statusFatura?.nome ?? null,
                            valorCobranca: fl.valorCobranca ?? null,
                            ano: fl.ano ?? null,
                            mes: fl.mes ?? null,
                            numero: fl.numero ?? null,
                        }));
                    }

                    if (Array.isArray(vencidasArr)) {
                        vencidasArr.forEach(fv => faturas.push({
                            codigo: fv.codigo ?? null,
                            dataFatura: fv.dataFatura ?? null,
                            dataPagamento: null,
                            dataVencimento: fv.dataVencimento ?? null,
                            dataVencimentoCobranca: fv.dataVencimentoCobranca ?? null,
                            linkFatura: fv.linkFatura ?? null,
                            linhaDigitavel: fv.linhaDigitavel ?? null,
                            linkReciboPagamento: null,
                            pixCopiaCola: fv.pixList?.length ? fv.pixList[0]?.brcode ?? null : null,
                            statusFatura: fv.statusFatura?.nome ?? null,
                            valorCobranca: fv.valorCobranca ?? null,
                            ano: fv.ano ?? null,
                            mes: fv.mes ?? null,
                            numero: fv.numero ?? null,
                        }));
                    }

                    if (Array.isArray(baixadasArr)) {
                        baixadasArr.forEach(fb => faturas.push({
                            codigo: fb.codigo ?? null,
                            dataFatura: fb.dataFatura ?? null,
                            dataPagamento: fb.dataPagamento ?? null,
                            dataVencimento: fb.dataVencimento ?? null,
                            dataVencimentoCobranca: fb.dataVencimentoCobranca ?? null,
                            linkFatura: null,
                            linhaDigitavel: null,
                            linkReciboPagamento: fb.linkReciboPagamento ?? null,
                            pixCopiaCola: null,
                            statusFatura: fb.statusFatura?.nome ?? null,
                            valorCobranca: fb.valorCobranca ?? null,
                            ano: fb.ano ?? null,
                            mes: fb.mes ?? null,
                            numero: fb.numero ?? null,
                        }));
                    }

                    if (Array.isArray(pagasNoCartaoArr)) {
                        pagasNoCartaoArr.forEach(fpc => faturas.push({
                            codigo: fpc.codigo ?? null,
                            dataFatura: fpc.dataFatura ?? null,
                            dataPagamento: fpc.dataPagamento ?? null,
                            dataVencimento: fpc.dataVencimento ?? null,
                            dataVencimentoCobranca: fpc.dataVencimentoCobranca ?? null,
                            linkFatura: null,
                            linhaDigitavel: null,
                            linkReciboPagamento: fpc.linkReciboPagamento ?? null,
                            pixCopiaCola: null,
                            statusFatura: fpc.statusFatura?.nome ?? null,
                            valorCobranca: fpc.valorCobranca ?? null,
                            ano: fpc.ano ?? null,
                            mes: fpc.mes ?? null,
                            numero: fpc.numero ?? null,
                        }));
                    }

                    if (Array.isArray(reemitidasArr)) {
                        reemitidasArr.forEach(fr => faturas.push({
                            codigo: fr.codigo ?? null,
                            dataFatura: fr.dataFatura ?? null,
                            dataPagamento: null,
                            dataVencimento: fr.dataVencimento ?? null,
                            dataVencimentoCobranca: fr.dataVencimentoCobranca ?? null,
                            linkFatura: fr.linkFatura ?? null,
                            linhaDigitavel: fr.linhaDigitavel ?? null,
                            linkReciboPagamento: null,
                            pixCopiaCola: fr.pixList?.length ? fr.pixList[0]?.brcode ?? null : null,
                            statusFatura: fr.statusFatura?.nome ?? null,
                            valorCobranca: fr.valorCobranca ?? null,
                            ano: fr.ano ?? null,
                            mes: fr.mes ?? null,
                            numero: fr.numero ?? null,
                        }));
                    }
                }

                sortFaturasPorVencimentoDesc(faturas);

                return {
                    codigo: contrato?.codigo ?? null,
                    dependentes,
                    entidade,
                    faturas,
                    operadora: {
                        id: contrato?.plano?.operadora?.id ?? null,
                        nome: contrato?.plano?.operadora?.nome ?? null,
                        numeroAns: contrato?.plano?.operadora?.numeroAns ?? null,
                    },
                    plano: {
                        codigo: contrato?.plano?.codigo ?? null,
                        nome: contrato?.plano?.nome ?? null,
                        abrangencia: contrato?.plano?.abrangencia?.nome ?? null,
                        acomodacao: contrato?.plano?.acomodacaoApi?.nome ?? null,
                        registroAns: contrato?.plano?.registroAns ?? null,
                        status: contrato?.plano?.statusPlanoApi?.nome ?? null
                    },
                    produto: {
                        codigo: contrato?.plano?.produto?.codigo ?? null,
                        nome: contrato?.plano?.produto?.nome ?? null,
                    },
                    responsavel: {
                        nome: contrato?.nomeResponsavel ?? null,
                        cpf: contrato?.cpfResponsavel ?? null,
                    },
                    statusContrato: contrato?.statusContrato?.nome ?? null,
                    titular,
                    vigencia: titular?.dataVigencia ?? null,
                    modalidade: contrato?.entidade ? 'Entidade' : 'Adesão',
                };
            }
        );

        res.set('X-Perf-ms', String(Date.now() - __t0));
        return res.send({
            contratos: contracts,
            message: `Lista de contratos e faturas encontrados para o CPF: ${req.params.cpf}`,
            sucesso: true
        });

    } catch (err) {
        res.set('X-Perf-ms', String(Date.now() - __t0));
        console.error('Erro ao buscar boletos:', err);
        return res.status(500).send({ message: err.message, sucesso: false });
    }
};
