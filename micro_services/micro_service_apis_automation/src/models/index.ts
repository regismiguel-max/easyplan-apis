import { sequelize } from "../config/database";
import PropostaModel from "./proposta.model";
import ClienteDigitalBeneficiarioModel from "./beneficiarios.model";
import SyncLogModel from "./synclogs.model";

/**
 * Inicializa e autentica a conexão com o banco.
 * Use este método apenas para conectar, sem sincronizar os modelos.
 */
export const initModels = async () => {
    try {
        // Inicialização dos modelos
        PropostaModel.initialize(sequelize);
        ClienteDigitalBeneficiarioModel.initialize(sequelize);
        SyncLogModel.initialize(sequelize);

        // Conecta ao banco
        await sequelize.authenticate();
        console.log("✅ Conexão com banco de dados estabelecida.");
    } catch (error) {
        console.error("❌ Erro ao inicializar os modelos:", (error as Error).message);
    }
};

export {
    sequelize,
    PropostaModel,
    ClienteDigitalBeneficiarioModel,
    SyncLogModel,
};
