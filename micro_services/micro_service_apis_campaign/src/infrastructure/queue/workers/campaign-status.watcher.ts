import { EmailCampaignStatus } from "../../../domain/types/email-status.types";
import { redisClient } from "../../database/config/redis.config";
import EmailCampaignRepository from "../../repositories/email-campaign.repository";

export async function checkCampaignStatus(campaignId: number) {
    const totalChunks = await redisClient.get(`campaign:${campaignId}:chunks:total`);
    if (!totalChunks) {
        console.error(`❌ Total de chunks não encontrado para campanha ${campaignId}`);
        return;
    }

    const total = parseInt(totalChunks, 10);

    const keys = Array.from({ length: total }, (_, i) => `campaign:${campaignId}:chunk:${i + 1}:status`);

    const statuses = await redisClient.mGet(keys);

    const sentCount = statuses.filter(s => s === 'SENT').length;
    const failedCount = statuses.filter(s => s === 'FAILED').length;
    const processingCount = statuses.filter(s => s === 'PROCESSING').length;
    const queuedCount = statuses.filter(s => s === 'QUEUED').length;

    console.log(`🧠 Status campanha ${campaignId}: SENT=${sentCount}, FAILED=${failedCount}, PROCESSING=${processingCount}, QUEUED=${queuedCount}`);

    const repository = new EmailCampaignRepository();

    if (sentCount === total) {
        await repository.updateStatus(campaignId, EmailCampaignStatus.SENT);
        console.log(`✅ Campanha ${campaignId} marcada como SENT.`);
    } else if (failedCount > 0) {
        await repository.updateStatus(campaignId, EmailCampaignStatus.FAILED);
        console.log(`❌ Campanha ${campaignId} marcada como FAILED.`);
    } else {
        console.log(`🕒 Campanha ${campaignId} ainda em processamento.`);
    }
}
