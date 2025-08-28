"use strict";
const http = require("http");
const https = require("https");
const express = require("express");
const fs = require('fs');
const morganBody = require('morgan-body');
const path = require('path');
const moment = require("moment");
require('dotenv').config({ path: path.resolve(__dirname, './.env') });

const cronIncentiveStatus = require('./app/controllers/supervisores/incentivos-comerciais/cron/incentive-status.cron');

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
const log = createLogger('api', 'micro_service_apis', 'Micro_Service_APIs');

// Log manual de evento
log('✅ Microserviço principal iniciado');

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
    maxBodyLength: 5 * 1024 * 1024,
    skip: (req, res) => req.originalUrl === '/favicon.ico'
});

const db = require("../../models");

// para produção ou se roles já criados
// db.sequelize.sync();
db.sequelize.authenticate();

// simple route
app.get("/", (req, res) => {
    res.json({ message: "Welcome to base EasyPlan application." });
});

// routes
const routes = require("./app/routes/index");
app.use(routes);
app.use('/uploads', express.static(path.resolve(__dirname, '../../../uploads')));

const https_port = process.env.PORT || 3088;
https.createServer(credentials, app).listen(https_port, () => { console.log('Server listening at https://localhost:' + https_port); });