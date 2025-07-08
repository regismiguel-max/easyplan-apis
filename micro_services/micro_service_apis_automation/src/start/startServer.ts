import app from "../app";
import { initModels } from "../models";
// import { agendarExecucaoPrincipal } from "../cron/agendaPrincipal.cron";
import { requestLogger } from "../middlewares/requestLogger.middleware";
import logger from "../config/logger.config";
import { agendarExecucaoCompleta } from "../queues/schedulers/sync.scheduler";

export const startServer = async () => {
    const PORT = process.env.PORT || 3096;

    try {
        app.use(requestLogger);

        await initModels();
        logger.info("✅ Models inicializados com sucesso.");

        // agendarExecucaoPrincipal();
        // await agendarExecucaoCompleta(); // agendamento com BullMQ
        // logger.info("📅 Job de sincronização agendado com BullMQ.")

        app.listen(PORT, () => {
            logger.info(`🚀 Servidor rodando na porta ${PORT}`);
        });
    } catch (error) {
        logger.error(`❌ Erro ao iniciar o servidor: ${(error as Error).message}`);
        process.exit(1);
    }
};
