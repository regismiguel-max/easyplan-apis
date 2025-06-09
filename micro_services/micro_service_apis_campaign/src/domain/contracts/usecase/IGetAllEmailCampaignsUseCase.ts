import EmailCampaign from "../../entities/interfaces/email-campaign/email-campaign.interface";
export default interface IGetAllEmailCampaignsUseCase {
    execute(): Promise<EmailCampaign[]>;
}