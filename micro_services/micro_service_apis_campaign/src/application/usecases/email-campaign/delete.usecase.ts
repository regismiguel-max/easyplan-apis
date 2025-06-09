import IDeleteEmailCampaignUseCase from "../../../domain/contracts/usecase/IDeleteEmailCampaignUseCase";
import EmailCampaignRepository from "../../../infrastructure/repositories/email-campaign.repository";
import EmailFiltersRepository from "../../../infrastructure/repositories/email-filters.repository";
import { EmailCampaignScheduleRepository } from "../../../infrastructure/repositories/email-schedule.repository";
import CRUDEmailCampaignDTO from "../../../presentation/dtos/email-campaign/input/crud-email-campaign.dto";

export default class DeleteEmailCampaignUseCase implements IDeleteEmailCampaignUseCase {
    constructor(
        private emailCampaignRepository: EmailCampaignRepository,
        private emailFiltersRepository: EmailFiltersRepository,
        private emailScheduleRepository: EmailCampaignScheduleRepository
    ) {}
    async execute(id: number): Promise<string> {
        if (!id) throw new Error("ID da campanha é obrigatório para exclusão.");

        // 1. Deleta filtros associados
        await this.emailFiltersRepository.deleteAllFiltersByCampaignId(id);

        await this.emailCampaignRepository.deleteRecipientsGroup(id);

        // 2. Deleta agendamento, se houver
        // await this.emailScheduleRepository.deleteByCampaignId(id);

        // 3. Deleta a campanha em si
        const campaignDeletionResult = await this.emailCampaignRepository.delete(id);

        if (!campaignDeletionResult || campaignDeletionResult.includes("Falha")) throw new Error("Falha ao deletar a campanha de e-mail.");

        return "Campanha deletada com sucesso.";
    }
}