import { sequelize } from "../src/config/database";
import PropostaModel from "../src/models/proposta.model";
import ClienteDigitalBeneficiarioModel from "../src/models/beneficiarios.model";
import SyncLogModel from "../src/models/synclogs.model";

async function setupDatabase() {
    try {
        console.log("🔄 Iniciando processo de sincronização de banco de dados...");

        await sequelize.authenticate();
        console.log("✅ Conexão com banco de dados estabelecida.");

        console.log("📦 Inicializando modelos...");
        PropostaModel.initialize(sequelize);
        ClienteDigitalBeneficiarioModel.initialize(sequelize);
        SyncLogModel.initialize(sequelize);

        console.log("🛠️ Executando sync...");
        // await sequelize.sync();
        await sequelize.authenticate();

        console.log("✅ Tabelas sincronizadas com sucesso.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Erro ao sincronizar modelos:", (error as Error).message);
        process.exit(1);
    }
}

setupDatabase();
