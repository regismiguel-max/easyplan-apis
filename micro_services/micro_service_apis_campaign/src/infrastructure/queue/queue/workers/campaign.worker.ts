import { Worker } from "bullmq";
import { redisConfig } from "../../../config/redis-config";
import CampaignSenderFactory from "../../../../domain/factories/campaign-sender-factory";
import EmailCampaignRepository from "../../../repositories/email-campaign.repository";
import { EmailCampaignStatus } from "../../../../domain/types/email-status.types";
import { redisClient } from "../../../database/config/redis.config";

const repository = new EmailCampaignRepository();

const campaignWorker = new Worker(
  "campaignQueue",
  async (job) => {
    const campaignId = job.data.baseData.id;
    const jobId = job.id;
    const recipientCount = job.data.recipientGroup.length;

    console.log(
      `🚀 Processando job ${jobId} - Campanha ${campaignId} - ${recipientCount} emails`
    );

    const redisKey = `campaign:${campaignId}:job:${jobId}`;

    // Verificar se já foi processado
    const jobStatus = await redisClient.hGet(redisKey, "status");

    if (jobStatus && ["SENT", "PROCESSING"].includes(jobStatus)) {
      console.log(
        `⚠️ Job ${jobId} da campanha ${campaignId} já foi processado. Status: ${jobStatus}`
      );
      return;
    }

    // Marcar como processando
    await redisClient.hSet(redisKey, {
      status: "PROCESSING",
      updatedAt: new Date().toISOString(),
      recipientCount: recipientCount.toString(),
    });

    const sender = CampaignSenderFactory.getSender(job.data.channel);

    try {
      console.log(
        `📧 Enviando ${recipientCount} emails para campanha ${campaignId}...`
      );
      await sender.senderCampaing(job.data);

      await redisClient.hSet(redisKey, {
        status: "SENT",
        updatedAt: new Date().toISOString(),
        error: "",
        sentAt: new Date().toISOString(),
      });

      console.log(
        `✅ Job ${jobId} da campanha ${campaignId} enviado com sucesso! ${recipientCount} emails processados.`
      );
    } catch (error: any) {
      await redisClient.hSet(redisKey, {
        status: "FAILED",
        updatedAt: new Date().toISOString(),
        error: error.message || JSON.stringify(error),
      });

      await redisClient.hIncrBy(redisKey, "retryCount", 1);

      console.error(`Erro ao enviar campanha ${job.data.channel}:`, error);
      console.log("Mensagem:", error.message);
      console.log("Stack:", error.stack);
      console.log("Response:", error.response?.body);
      console.log("Status Code:", error.code || error?.response?.statusCode); // Tratar especificamente erro de timeout
      if (error.code === "ETIMEDOUT" || error.code === "ECONNRESET") {
        console.log(
          `🌐 WORKER: Erro de conectividade com SendGrid (${error.code}). Aguardando antes de tentar novamente...`
        );
        throw error;
      }

      const statusCode = error?.code || error?.response?.statusCode;

      if (statusCode === 429) {
        // Rate limit
        console.log("🚫 WORKER: Erro de rate limit SendGrid:", error.message);
        throw error;
      } else if (statusCode >= 500) {
        // Server error
        console.log(
          "🔴 WORKER: Erro do servidor SendGrid. Tentar novamente:",
          error.message
        );
        throw error;
      } else if (statusCode >= 400) {
        // Client error
        console.log(
          "⚠️ WORKER: Erro do cliente. Não tentar novamente:",
          error.message
        );
        return;
      }

      throw error; // Isso permite que o BullMQ tente reenviar o job
    }
  },
  {
    connection: redisConfig,
    concurrency: 2, // Reduzir para 2 workers simultâneos
  }
);
console.log("Conectando Redis na Fila:", redisConfig);
console.log("Worker de campanhas iniciado!");
