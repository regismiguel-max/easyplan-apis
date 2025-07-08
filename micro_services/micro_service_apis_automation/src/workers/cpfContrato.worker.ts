import { Worker } from "bullmq";
import { cpfContratoProcessor } from "../processors/cpfContrato.processor";
import { redisConnection } from "../config/redis.config";
import logger from "../config/logger.config";
import { initModels } from "../models";

(async () => {
    try {
        await initModels(); // Inicializa os models antes de iniciar o worker
        logger.info("✅ Models inicializados no Worker CPF-Contrato.");

        const worker = new Worker(
            "cpf-contrato",
            cpfContratoProcessor,
            {
                connection: redisConnection,
                concurrency: 1,
            }
        );

        worker.on("completed", (job) => {
            logger.info(`✅ Job CPF-Contrato concluído: ${job.id}`);
        });

        worker.on("failed", (job, err) => {
            logger.error(`❌ Job CPF-Contrato falhou: ${job?.id} - ${err.message}`);
        });

    } catch (err: any) {
        logger.error(`❌ Erro ao iniciar worker CPF-Contrato: ${err.message}`);
        process.exit(1);
    }
})();
