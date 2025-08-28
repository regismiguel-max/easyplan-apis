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
const log = createLogger('api', 'micro_service_apis_clientes', 'Micro_Service_APIs_Clientes');

// Log manual de evento
log('👤 Microserviço de clientes iniciado');

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

// db.sequelize.sync();
db.sequelize.authenticate();

// simple route
app.get("/", (req, res) => {
    res.json({ message: "Welcome to base EasyPlan application." });
});

// routes
require('./app/routes/clientes/auth.routes')(app);
require('./app/routes/clientes/user.routes')(app);
require('./app/routes/clientes/twoFactorAuthentication.routes')(app);
require('./app/routes/push/push_dispositivos.routes')(app);
require('./app/routes/beneficiarios/beneficiarios.routes')(app);
require('./app/routes/redes-credenciadas/redesCredenciadas.routes')(app);
require('./app/routes/contatos/contatos.routes')(app);


const https_port = process.env.PORT || 3092;
https.createServer(credentials, app).listen(https_port, () => { console.log('Server listening at http://localhost:' + https_port); });
