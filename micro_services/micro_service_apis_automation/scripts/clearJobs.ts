import { Queue } from "bullmq";
import { redisConnection } from "../src/config/redis.config";

async function clearAllQueues() {
  const filaNomes = ["sync", "cpf-contrato"]; // Adicione aqui outras filas se necessário

  for (const nomeFila of filaNomes) {
    const queue = new Queue(nomeFila, { connection: redisConnection });

    await queue.drain(); // Remove jobs waiting/delayed
    await queue.clean(0, 1000, "completed");
    await queue.clean(0, 1000, "failed");
    await queue.obliterate({ force: true }); // Remove todos os jobs

    console.log(`🧹 Fila '${nomeFila}' limpa com sucesso.`);
  }

  process.exit(0);
}

clearAllQueues();
