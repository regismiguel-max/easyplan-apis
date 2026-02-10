const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const axios = require('axios');
const http = require('http');
const https = require('https');

/**
 * Env esperadas:
 * BASEURL                -> API de contratos (ex.: /contrato/procurarPorCpfTitular)
 * TOKEN, SENHA_API       -> headers para BASEURL
 *
 * BASEURL_DIGITAL        -> API Digital (ex.: /fatura/procurarPorContrato, /procurarLiquidadasPorContrato)
 * DIGITAL_TOKEN, DIGITAL_SENHA_API -> headers para BASEURL_DIGITAL (fallback p/ TOKEN/SENHA_API)
 *
 * HTTP_TIMEOUT_MS        -> timeout axios por requisição (ms) [default 10000]
 * KEEPALIVE_MS           -> keep-alive sockets (ms) [default 30000]
 * MAX_SOCKETS            -> conexões simultâneas por agente [default 100]
 */

const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS) || 10000;
const KEEPALIVE_MS = Number(process.env.KEEPALIVE_MS) || 30000;
const MAX_SOCKETS = Number(process.env.MAX_SOCKETS) || 100;

const buildHttpAgent = () => new http.Agent({
    keepAlive: true,
    keepAliveMsecs: KEEPALIVE_MS,
    maxSockets: MAX_SOCKETS,
    scheduling: 'fifo',
});

const buildHttpsAgent = () => new https.Agent({
    keepAlive: true,
    keepAliveMsecs: KEEPALIVE_MS,
    maxSockets: MAX_SOCKETS,
    scheduling: 'fifo',
});

const createInstance = ({ baseURL, token, senhaApi }) => {
    const headers = {};
    if (token) headers['token'] = token;
    if (senhaApi) headers['senhaApi'] = senhaApi;

    return axios.create({
        baseURL,
        headers,
        timeout: HTTP_TIMEOUT_MS,
        httpAgent: buildHttpAgent(),
        httpsAgent: buildHttpsAgent(),
        // validateStatus: s => s >= 200 && s < 300, // default
    });
};

const httpsInstance = createInstance({
    baseURL: process.env.BASEURL,
    token: process.env.TOKEN || process.env.token,
    senhaApi: process.env.SENHA_API || process.env.senhaApi,
});

const httpsDigitalInstance = createInstance({
    baseURL: process.env.BASEURL_DIGITAL || process.env.DIGITAL_BASE_URL,
    token: process.env.DIGITAL_TOKEN || process.env.TOKEN || process.env.token,
    senhaApi: process.env.DIGITAL_SENHA_API || process.env.SENHA_API || process.env.senhaApi,
});


const createInstanceSupaBase = ({ baseURL, token }) => {
    const headers = {};
    if (token) headers['x-api-key'] = token;

    headers['Content-Type'] = 'application/json';

    return axios.create({
        baseURL,
        headers,
        timeout: HTTP_TIMEOUT_MS,
        httpAgent: buildHttpAgent(),
        httpsAgent: buildHttpsAgent(),
        // validateStatus: s => s >= 200 && s < 300, // default
    });
};

const httpsSupaBaseInstance = createInstanceSupaBase({
    baseURL: process.env.BASEURL_SUPABASE,
    token: process.env.SUPABASE_TOKEN,
});

module.exports = {
    https: httpsInstance,              // contratos (contrato/procurarPorCpfTitular)
    https_digital: httpsDigitalInstance, // faturas (/fatura/...)
    https_supabase: httpsSupaBaseInstance
};
