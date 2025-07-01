import path from "path";
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
            // let baseName: string = '';
            // let absolutePath: string = '';
            // if(result.campaignTemplateModel.templateContent.includes('C:') || result.campaignTemplateModel.templateContent.includes('D:')){
                //     baseName = path.basename(result.campaignTemplateModel.templateContent);
                //     console.log(baseName);
                //     absolutePath = path.join(absolutePathTemplateHTML, baseName);
                // } else {
            // }
                
                
            const absolutePathTemplateHTML = path.resolve(__dirname, '../../../templateHTML');
            console.log('absolutePathTemplateHTML local: ', absolutePathTemplateHTML);
            
            const absolutePath = path.join(absolutePathTemplateHTML, result.campaignTemplateModel.templateContent);

            console.log('absolutePath local: ', absolutePath);

            const htmlContent = fs.readFileSync(absolutePath, 'utf-8');
            
            console.log('html lido: ', htmlContent);
            
            result.campaignTemplateModel.templateContent = htmlContent;
        }

        return result;
    }
}