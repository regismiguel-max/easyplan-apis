import IEmailCampaignRepository from "../../../domain/contracts/repositories/IEmailCampaignRepository";
import IGetAllEmailCampaignsUseCase from "../../../domain/contracts/usecase/IGetAllEmailCampaignsUseCase";
import EmailCampaign from "../../../domain/entities/interfaces/email-campaign/email-campaign.interface";

export default class GetAllEmailCampaignsUseCase implements IGetAllEmailCampaignsUseCase {
    constructor(private emailCampaignRepository: IEmailCampaignRepository) {}

    public async execute(): Promise<EmailCampaign[]> {
        const emailCampaignsDB: EmailCampaign[] = await this.emailCampaignRepository.findAll();

        if (!emailCampaignsDB) throw new Error("Erro");

        return emailCampaignsDB;
    }
}