const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const axios = require('axios');
const http = require('http');
const https = require('https');

module.exports = {
    https: axios.create({
        baseURL: process.env.BASEURLPLANIUM,
        headers: {
            'Planium-apikey': process.env.apikeyplanium,
        },
        httpAgent: new http.Agent({
            keepAlive: true,
            keepAliveMsecs: 0,
            timeout: 120000,
            scheduling: 'fifo',
        }),
        httpsAgent: new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 0,
            timeout: 120000,
            scheduling: 'fifo',
        }),
    }),

    digital: axios.create({
        baseURL: process.env.BASEURL,
        headers: {
            'token': process.env.token,
            'senhaApi': process.env.senhaApi,
        },
        httpAgent: new http.Agent({
            keepAlive: true,
            keepAliveMsecs: 0,
            timeout: 120000,
            scheduling: 'fifo',
        }),
        httpsAgent: new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 0,
            timeout: 120000,
            scheduling: 'fifo',
        }),
    })
}

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

const createInstance = ({ baseURL, headers = {} }) => {
    return axios.create({
        baseURL,
        headers,
        timeout: HTTP_TIMEOUT_MS,
        httpAgent: buildHttpAgent(),
        httpsAgent: buildHttpsAgent(),
    });
};

const httpsInstance = createInstance({
    baseURL: process.env.BASEURL, // ex.: https://api.seuservico.com
    headers: {
        token: process.env.TOKEN || process.env.token,
        senhaApi: process.env.SENHA_API || process.env.senhaApi,
    },
});

/**
 * FATURAS (Digital) — liquidadas por contrato
 * - GET /fatura/procurarLiquidadasPorContrato?codigoContrato=...
 */
const httpsDigitalInstance = createInstance({
    baseURL: process.env.BASEURL_DIGITAL || process.env.DIGITAL_BASE_URL,
    headers: {
        token: process.env.DIGITAL_TOKEN || process.env.TOKEN || process.env.token,
        senhaApi: process.env.DIGITAL_SENHA_API || process.env.SENHA_API || process.env.senhaApi,
    },
});

/**
 * DNV (Planium) — propostas por período
 * - POST /prod/proposta/consulta/v1
 *   Header: Planium-apikey: <chave>
 *   Body: { cnpj_operadora, data_inicio, data_fim }
 */
const dnvBaseUrl = process.env.BASEURLPLANIUM || 'https://dnv-api.planium.io/prod/';
const httpsDnvInstance = createInstance({
    baseURL: dnvBaseUrl,
    headers: {
        'Planium-apikey': process.env.apikeyplanium,
        // se precisar content-type explícito:
        // 'Content-Type': 'application/json',
    },
});

module.exports = {
    https: httpsInstance,             // contratos
    https_digital: httpsDigitalInstance, // faturas
    https_dnv: httpsDnvInstance,      // DNV (Planium)
};