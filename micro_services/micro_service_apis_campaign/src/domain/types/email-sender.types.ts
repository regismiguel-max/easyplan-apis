import EmailCampaignEntity from "../entities/EmailCampaign";

export default interface EmailSenderType {
    baseData: EmailCampaignEntity;
    template: string;
    recipientGroup: string[];
    channel: string;
}