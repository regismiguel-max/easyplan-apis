import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from 'path';
import cors from 'cors';
import https from 'https';

import campaignRoutes from "./presentation/routes/campaign.routes";
import emailFiltersRoutes from "./presentation/routes/email-filters.routes";
import connection_db from "./infrastructure/database/config/database";

import './presentation/cron/updateWhatsappStatus.cron';

import { associateModels } from "./infrastructure/database/models/associate.models";

import corsOptions from './utils/cors/corsOptionsCampaign';
import loadSSL from './sslcert/loadSSLCampaign';

// ✅ Carrega as variáveis de ambiente corretamente
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.CAMPAIGN_PORT ? Number(process.env.CAMPAIGN_PORT) : 3094;

// ✅ Middleware CORS
app.use(cors(corsOptions));

// ✅ Middleware Body Parser (se preferir, pode usar express.json() e express.urlencoded())
app.use(bodyParser.json());

// ✅ Rotas
app.use("/campaign/email", campaignRoutes);
app.use("/campaign/email/filters", emailFiltersRoutes);
app.use("/public", express.static('public'));

//************** BANCO DE DADOS ************/
// Inicializar associação das tabelas
associateModels();

connection_db.authenticate()
  .then(() => console.log('Conexão com o banco de dados bem-sucedida!'))
  .catch((err: unknown) => {
    console.error('Erro ao conectar ao banco de dados:', err);
    process.exit(1);
  });

// ✅ HTTPS Server
const credentials = loadSSL();
https.createServer(credentials, app).listen(PORT, () => {
  console.log(`Server listening at https://localhost:${PORT}`);
});
