import ICampaignRepository from "../../domain/contracts/repositories/ICampaignRepository";
import IGetAllCampaignsUseCase from "../../domain/contracts/usecase/IGetAllCampaignsUseCase";
import Campaign from "../../domain/entities/interfaces/campaign.interface";

export default class GetAllCampaignsUseCase implements IGetAllCampaignsUseCase {
    constructor(private campaignRepository: ICampaignRepository) {}

    public async execute(typeCampaign: string): Promise<Campaign[]> {
        const campaignsDB: Campaign[] = await this.campaignRepository.findAll(typeCampaign);

        if (!campaignsDB) throw new Error("Erro");

        return campaignsDB;
    }
}