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

module.exports = {
    https: httpsInstance,              // contratos (contrato/procurarPorCpfTitular)
    https_digital: httpsDigitalInstance // faturas (/fatura/...)
};