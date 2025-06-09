import { ShortFullEmailCampaign } from "../../entities/interfaces/email-campaign/full-email-campaign.interface";
export default interface IGetEmailCampaignUseCase {
    execute(dto: number): Promise<ShortFullEmailCampaign>;
}