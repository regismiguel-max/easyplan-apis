import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import campaignRoutes from "./presentation/routes/campaign.routes";
import emailFiltersRoutes from "./presentation/routes/email-filters.routes";
import connection_db from "./infrastructure/database/config/database";
import cors from 'cors';
import './presentation/cron/updateWhatsappStatus.cron';

import { associateModels } from "./infrastructure/database/models/associate.models";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use("/campaign/email", campaignRoutes);
app.use("/campaign/email/filters", emailFiltersRoutes);
app.use("/public", express.static('public'));

//************** BANCO DE DADOS ************/
// Inicializar associação das tabelas
associateModels();

connection_db.authenticate()
  .then(() => console.log("Conexão com o banco de dados bem-sucedida!"))
  .catch( err => console.error('Erro ao conectar ao banco de dados: ', err));

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
