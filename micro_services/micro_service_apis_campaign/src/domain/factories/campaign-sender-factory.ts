import EmailCampaignSender from "../../infrastructure/providers/email-campaign-sender.provider";
import WhatsappCampaignSender from "../../infrastructure/providers/whatsapp-campaign-sender.provider";
import ICampaignSenderStrategy from "../contracts/service/ICampaingSenderStrategy";

export default class CampaignSenderFactory {
    senderCampaing(data: any) {
        throw new Error("Method not implemented.");
    }
    static getSender(channel: string): ICampaignSenderStrategy {
        switch(channel) {
            case 'email': return new EmailCampaignSender();
            case 'whatsapp': return new WhatsappCampaignSender();
            // case "SMS": return new SmsCampaignSender();
            // case "PUSH": return new PushNotificationSender();

            default: throw new Error(`Tipo de campanha inválida: ${channel}`);
        }
    }
}