import cron from "node-cron";
import { UpdateWhatsappStatusUseCase } from "../../application/usecases/send-campaign/update-whats-statistics.usecase";
import CampaignRepository from "../../infrastructure/repositories/campaign.repository";
import StatisticsWhatsCampaignRepository from "../../infrastructure/repositories/statistics-whats-campaign.repository";
console.log('🔁 Cron de atualização de status de campanhas WhatsApp carregado.');

const useCase = new UpdateWhatsappStatusUseCase(
    new CampaignRepository(),
    new StatisticsWhatsCampaignRepository()
);

cron.schedule('0 */30 * * * *', async () => {
    console.log('⏰ Cron job iniciado');
    await useCase.execute();
})