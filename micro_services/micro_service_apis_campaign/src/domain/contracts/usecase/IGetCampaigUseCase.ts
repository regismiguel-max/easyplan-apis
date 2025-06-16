import ShortFullEmailCampaign from "../../entities/interfaces/email-campaign/full-email-campaign.interface";
export default interface IGetCampaignUseCase {
    execute(dto: number): Promise<ShortFullEmailCampaign>;
}