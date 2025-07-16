import { Worker } from "bullmq";
import { syncProcessor } from "../processors/sync.processor";
import { redisConnection } from "../config/redis.config";
import logger from "../config/logger.config";
import { initModels } from "../models";

(async () => {
    try {
        await initModels(); // ✅ Inicializa os models ANTES de iniciar o worker
        logger.info("✅ Models inicializados no Worker de sincronização.");

        const syncWorker = new Worker(
            "sync",
            syncProcessor,
            {
                connection: redisConnection,
                concurrency: 1,
            }
        );

        syncWorker.on("completed", (job) => {
            logger.info(`✅ Job concluído: ${job.id} (${job.name})`);
        });

        syncWorker.on("failed", (job, err) => {
            logger.error(`❌ Job falhou: ${job?.id} (${job?.name}) - ${err.message}`);
        });

    } catch (err: any) {
        logger.error(`❌ Erro ao iniciar syncWorker: ${err.message}`);
        process.exit(1);
    }
})();
