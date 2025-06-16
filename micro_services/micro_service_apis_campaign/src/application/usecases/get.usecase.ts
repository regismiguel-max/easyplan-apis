import IGetCampaignUseCase from "../../domain/contracts/usecase/IGetCampaigUseCase";
import ShortFullEmailCampaign from "../../domain/entities/interfaces/email-campaign/full-email-campaign.interface";
import CampaignRepository from "../../infrastructure/repositories/campaign.repository";
import * as fs from 'fs';

export default class GetCampaignUseCase implements IGetCampaignUseCase {
    constructor(private campaignRepository: CampaignRepository) {}

    public async execute(idEmailCampaign: number): Promise<ShortFullEmailCampaign> {
        // Pedir para o repository realizar a devida query
        const result: ShortFullEmailCampaign = await this.campaignRepository.findById(idEmailCampaign);

        if (!result) {
            throw new Error("error");
        }

        if(result.campaignTemplateModel) {
            const htmlContent = fs.readFileSync(result.campaignTemplateModel.templateContent, 'utf-8');
            
            result.campaignTemplateModel.templateContent = htmlContent;
        }

        return result;
    }
}