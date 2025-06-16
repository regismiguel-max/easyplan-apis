import { SendCampaignDTO } from "../../entities/interfaces/send-data.interface";

export default interface ICampaignSenderStrategy {
    senderCampaing(data: SendCampaignDTO): Promise<any>;
}