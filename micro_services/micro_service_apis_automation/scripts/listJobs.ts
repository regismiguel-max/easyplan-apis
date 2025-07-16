import { Queue } from "bullmq";
import { redisConnection } from "../src/config/redis.config";

async function listAllJobs() {
    const filaNomes = ["sync", "cpf-contrato"]; // Adicione outras filas aqui se necessário
    const statuses = ["waiting", "active", "completed", "failed", "delayed"] as const;

    for (const nomeFila of filaNomes) {
        const queue = new Queue(nomeFila, { connection: redisConnection });
        console.log(`\n🔁 Fila: ${nomeFila.toUpperCase()}`);

        for (const status of statuses) {
            const jobs = await queue.getJobs([status], 0, 100); // ajuste o limite se necessário

            console.log(`\n📦 Status: ${status.toUpperCase()} (${jobs.length} job(s))\n`);

            for (const job of jobs) {
                console.log(`🆔 ID: ${job.id}`);
                console.log(`📄 Data:`, job.data);
                console.log(`🕒 Criado: ${new Date(job.timestamp).toLocaleString()}`);
                if (job.finishedOn)
                    console.log(`✅ Finalizado: ${new Date(job.finishedOn).toLocaleString()}`);
                if (job.failedReason)
                    console.log(`❌ Erro: ${job.failedReason}`);
                console.log('---');
            }
        }
    }

    process.exit(0);
}

listAllJobs();
