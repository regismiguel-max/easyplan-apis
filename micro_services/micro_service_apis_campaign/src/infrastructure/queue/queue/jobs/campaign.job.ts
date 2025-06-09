import SendEmailDTO from "../../../../domain/entities/interfaces/email-campaign/send-data.interface";
import { redisClient } from "../../../database/config/redis.config";
import { campaignQueue } from "../queue";

export const addCampaignToQueue = async (data: SendEmailDTO) => {
  // Criar um hash do conteúdo para evitar jobs duplicados
  const recipientsHash = Buffer.from(data.recipientGroup.sort().join(","))
    .toString("base64")
    .substring(0, 10);
  const contentHash = `${data.baseData.id}:${recipientsHash}:${data.recipientGroup.length}`;

  console.log(
    `🔑 JOB: Adicionando job para campanha ${data.baseData.id} com hash ${contentHash}`
  );

  const resultJob = await campaignQueue.add("sendCampaign", data, {
    priority: 1,
    jobId: contentHash, // Usar hash como ID do job para evitar duplicatas
  });

  const redisKey = `campaign:${data.baseData.id}:job:${resultJob.id}`;

  const alreadyExists = await redisClient.exists(redisKey);
  if (!alreadyExists) {
    await redisClient.hSet(redisKey, {
      status: "QUEUED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: "0",
      error: "",
      recipientCount: data.recipientGroup.length.toString(),
      contentHash: contentHash,
    });

    console.log(
      `✅ JOB: Job ${resultJob.id} criado para campanha ${data.baseData.id} com ${data.recipientGroup.length} destinatários`
    );
  } else {
    console.log(
      `⚠️ JOB: Job ${resultJob.id} já existia no Redis para campanha ${data.baseData.id}`
    );
  }

  return resultJob;
};