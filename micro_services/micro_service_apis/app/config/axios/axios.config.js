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
            keepAliveMsecs : 0,
            timeout: 120000,
            scheduling: 'fifo',
        }),
        httpsAgent: new https.Agent({
            keepAlive: true,
            keepAliveMsecs : 0,
            timeout: 120000,
            scheduling: 'fifo',
        }),
    })
}