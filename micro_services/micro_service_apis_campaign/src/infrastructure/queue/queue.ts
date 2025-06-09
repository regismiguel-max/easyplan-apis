import { Queue } from "bullmq";
import { redisConfig } from "../config/redis-config";

export const campaignQueue = new Queue("campaignQueue", {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3, // Aumentar para 3 tentativas para casos de timeout
    backoff: { type: "exponential", delay: 10000 }, // Aumentar delay para 10s
    removeOnComplete: true,
    removeOnFail: false,
    delay: 2000, // Delay inicial de 2s entre jobs
  },
});
console.log("🔗 Conectando Redis na Fila:", redisConfig);
(async () => {
  const jobCount = await campaignQueue.getWaitingCount();
  console.log(`Número de jobs pendentes na fila: ${jobCount}`);
  // const job = await campaignQueue.getJob();
})();