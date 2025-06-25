import IDeleteCampaignUseCase from "../../domain/contracts/usecase/IDeleteCampaignUseCase";
import CampaignRepository from "../../infrastructure/repositories/campaign.repository";
import filtersRepository from "../../infrastructure/repositories/filters.repository";
import { EmailCampaignScheduleRepository } from "../../infrastructure/repositories/email-schedule.repository";
import RecipientGroupRepository from "../../infrastructure/repositories/recipient-group.repository";
import StatisticsEmailCampaignRepository from "../../infrastructure/repositories/statistics-email-campaign.repository";
import StatisticsWhatsCampaignRepository from "../../infrastructure/repositories/statistics-whats-campaign.repository";

export default class DeleteCampaignUseCase implements IDeleteCampaignUseCase {
    constructor(
        private campaignRepository: CampaignRepository,
        private filtersRepository: filtersRepository,
        private recipientGroupRepository: RecipientGroupRepository,
        private emailScheduleRepository: EmailCampaignScheduleRepository,
        private emailStatistics: StatisticsEmailCampaignRepository,
        private whatsStatistics:StatisticsWhatsCampaignRepository
    ) {}
    async execute(id: number, typeCampaign: string): Promise<string> {
        if (!id) throw new Error("ID da campanha é obrigatório para exclusão.");

        // 1. Deleta filtros associados
        console.log('Começaremos os processos de exclusão');
        await this.filtersRepository.deleteAllFiltersByCampaignId(id);
        console.log('Filters deletados');
        

        await this.recipientGroupRepository.deleteRecipientsGroup(id);
        console.log('Grupo destinatário deletados');
        
        if(typeCampaign === 'email') {
            await this.emailStatistics.delete(id);
            console.log('Estatísticas deletadas');
        } else {
            await this.whatsStatistics.delete(id);
        }
        // 2. Deleta agendamento, se houver
        // await this.emailScheduleRepository.deleteByCampaignId(id);

        // 3. Deleta a campanha em si
        const campaignDeletionResult = await this.campaignRepository.delete(id);

        if (!campaignDeletionResult || campaignDeletionResult.includes("Falha")) throw new Error("Falha ao deletar a campanha de e-mail.");

        console.log('Tudo deletado com sucesso');
        
        return "Campanha deletada com sucesso.";
    }
}