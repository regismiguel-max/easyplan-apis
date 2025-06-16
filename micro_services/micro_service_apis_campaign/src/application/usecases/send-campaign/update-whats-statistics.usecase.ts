import KaulizHelper from "../../../infrastructure/queue/workers/kauliz-status.helper";
import CampaignRepository from "../../../infrastructure/repositories/campaign.repository";
import StatisticsWhatsCampaignRepository from "../../../infrastructure/repositories/statistics-whats-campaign.repository";

export class UpdateWhatsappStatusUseCase {
  constructor(
    private campaignRepository: CampaignRepository,
    private statisticsRepository: StatisticsWhatsCampaignRepository
  ) {}

  async execute(): Promise<void> {
    // const fiveHoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 5);
    // const campaigns = await this.campaignRepository.findWhatsCampaignsToUpdateStatus(fiveHoursAgo);
    const messages = await this.statisticsRepository.getMessageStatus();

    const pureMessage = messages.map(m => m.get({ plain: true }));

    for (const message of pureMessage) {
      try {
        const status = await KaulizHelper.getStatus(message.idMessage);
        console.log('Status retornado do helper: ', status);
        
        
        if (status === 1) {
          console.log('Status 1 entra aqui: ', status);
          await this.statisticsRepository.updateStatus(message.campaignId, 'ENVIADO', message.idMessage);
        } else if (status === 0) {
          console.log('Status 2 entra aqui: ', status);
          await this.statisticsRepository.updateStatus(message.campaignId, 'NÃO ENVIOU', message.idMessage);
        } else {
          console.log('Status 3 ou 4 entra aqui: ', status);
          await this.statisticsRepository.updateStatus(message.campaignId, 'FALHOU', message.idMessage);   
        }
        console.log(`✅ Campanha ${message.id} atualizada com sucesso`);
      } catch (error: any) {
        console.error(`❌ Erro ao atualizar campanha ${message.id}:`, error.message);
      }
    }
  }
}