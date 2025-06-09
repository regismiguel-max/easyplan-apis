import SendEmailDTO from "../../entities/interfaces/email-campaign/send-data.interface";

export default interface ICampaignSenderStrategy {
    senderCampaing(data: SendEmailDTO): Promise<any>;
}