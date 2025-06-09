"use strict";
const https = require("https");
const express = require("express");
const fs = require('fs');
const morganBody = require('morgan-body');
const path = require('path');
const moment = require("moment");
require('dotenv').config({ path: path.resolve(__dirname, './.env') });

const loadSSL = require('../../sslcert/loadSSL');
const credentials = loadSSL();

const bodyParser = require("body-parser");
const cors = require("cors");
const corsOptions = require('../../utils/cors/corsOptions');

const app = express();
app.use(cors(corsOptions));

// parse requests of content-type - application/json
app.use(bodyParser.json({ limit: "200mb" }));

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ limit: "200mb", extended: true, parameterLimit: 1000000 }));

const { createLogger } = require('../../utils/logs/logger');
const log = createLogger('api', 'micro_service_apis_digital_saude', 'Micro_Service_APIs_Digital_Saude');

// Log manual de evento
log('🩺 Microserviço Digital Saúde iniciado');

// Log automático de requisições HTTP
const morganStream = {
    write: (message) => log(message.trim())
};

// Aplica o morgan-body com opções detalhadas
morganBody(app, {
    noColors: true,
    stream: morganStream,
    logAllReqHeader: true,
    logRequestBody: true,
    logResponseBody: true,
    logIP: true,
    logMethod: true,
    logStatusCode: true,
    logReqDateTime: true,
    maxBodyLength: 1000,
    skip: (req, res) => req.originalUrl === '/favicon.ico'
});


// simple route
app.get("/", (req, res) => {
    res.json({ message: "Welcome to base EasyPlan application." });
});

// routes
require('./app/routes/access/token.routes')(app);
require('./app/routes/digital_saude/contrato.routes')(app);
require('./app/routes/digital_saude/fatura.routes')(app);
require('./app/routes/digital_saude/lancamento.routes')(app);
require('./app/routes/digital_saude/demonstrativo.routes')(app);

const https_port = process.env.PORT || 3090;
https.createServer(credentials, app).listen(https_port, () => { console.log('Server listening at https://localhost:' + https_port); });