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
    console.log('1° Grupo de Mensagens: ', messages);
    
    const pureMessage = messages.map(m => m.get({ plain: true }));
    console.log('1° Grupo de PureMensagens: ', pureMessage);
    
    if (pureMessage.length === 0) {
      console.log('✅ Nenhuma mensagem a ser atualizada. Finalizando job normalmente.');
      return;
    }
    
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

    console.log('Puremessage depois do for: ', pureMessage);
    console.log('Puremessage depois do for - item 0: ', pureMessage[0]);
    
    const campaignId = pureMessage[0].campaignId;
    console.log('Id da campanha: ', campaignId);
    
    const messagesAfterUpdate = await this.statisticsRepository.getMessageStatusByCampaignId(campaignId);
    console.log('2° Grupo de Mensagens: ', messages);
    
    const pureMessage2 = messagesAfterUpdate.map(m => m.get({ plain: true }));
    console.log('2° Grupo de PureMensagens: ', pureMessage);

    if (pureMessage2.length === 0) {
      console.warn('⚠️ Nenhuma mensagem encontrada após atualização de status.');
      return;
    }

    let sent: number = 0;
    let failed: number = 0;

    for(const messageAfterUpdate of pureMessage2) {
      const messageStatus = messageAfterUpdate.status;
      
      if(messageStatus === 'ENVIADO'){
        sent += 1;
      }else {
        failed += 1;
      }
    };

    console.log('Messages Status []', pureMessage2);
    
    const campaignId2 = pureMessage2[0].campaignId;
    const whatsappStatistic = await this.statisticsRepository.get(campaignId2);

    const totalRecipients = whatsappStatistic.countsRecipients;

    if(totalRecipients === 0) throw new Error('Total de destinatários é 0, houve erro em algum momento');
    
    const sentRate = Number( ( (sent / totalRecipients) * 100 ).toFixed(2) );
    
    const payload = {
      sent,
      failed,
      sentRate
    };
    console.log('Payload: ', payload);

    await this.statisticsRepository.update(payload, whatsappStatistic.id);
  }
}