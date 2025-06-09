const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const axios = require('axios');
const http = require('http');
const https = require('https');

module.exports = {
    https_digital: axios.create({
        baseURL: process.env.DIGITALSAUDEURL,
        headers: {
            'token': process.env.DIGITALSAUDETOKEN,
            'senhaApi': process.env.DIGITALSAUDESENHAAPI,
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
    https_onesignal: axios.create({
        baseURL: process.env.ONESIGNALURL,
        headers: {
            Authorization: `Key ${process.env.ONESIGNALTOKEN}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
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

