import IGetEmailCampaignUseCase from "../../../domain/contracts/usecase/IGetEmailCampaigUseCase";
import EmailCampaignEntity from "../../../domain/entities/EmailCampaign";
import FullEmailCampaign, { ShortFullEmailCampaign } from "../../../domain/entities/interfaces/email-campaign/full-email-campaign.interface";
import EmailCampaignRepository from "../../../infrastructure/repositories/email-campaign.repository";
import * as fs from 'fs';

export default class GetEmailCampaignUseCase implements IGetEmailCampaignUseCase {
    constructor(private emailCampaignRepository: EmailCampaignRepository) {}

    public async execute(idEmailCampaign: number): Promise<ShortFullEmailCampaign> {
        // Pedir para o repository realizar a devida query
        const result: ShortFullEmailCampaign = await this.emailCampaignRepository.findById(idEmailCampaign);

        if (!result) {
            throw new Error("error");
        }

        if(result.emailTemplateModel) {
            const htmlContent = fs.readFileSync(result.emailTemplateModel.absolutePath, 'utf-8');
            
            result.emailTemplateModel.absolutePath = htmlContent;
        }

        return result;
    }
}