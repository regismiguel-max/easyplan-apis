import { Queue } from "bullmq";
import { redisConnection } from "../../config/redis.config";
import logger from "../../config/logger.config";

const filaSync = new Queue("sync", { connection: redisConnection });

/**
 * Agenda a execução recorrente diária da sincronização completa às 02:00 da manhã (horário de Brasília).
 */
export const agendarExecucaoCompleta = async () => {
    const jobId = "job-sync-completo";

    // Verifica se já existe um job com repeat agendado
    const jobsRepetidos = await filaSync.getRepeatableJobs();
    const jaExiste = jobsRepetidos.some(job => job.id === jobId);

    if (jaExiste) {
        logger.info(`⏭️ Job 'completo' já está agendado com ID '${jobId}'. Ignorando novo agendamento.`);
        return;
    }

    await filaSync.add(
        "completo",
        {},
        {
            repeat: {
                pattern: "0 2 * * *", // horário agendado
                tz: "America/Sao_Paulo",
            },
            jobId: "job-sync-completo",
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 3000,
            },
            removeOnComplete: true,
            removeOnFail: false,
        }
    );

    logger.info(`⏰ Job 'completo' agendado diariamente às 02:00 (America/Sao_Paulo) com ID '${jobId}'.`);
};
