import EmailCampaignSender from "../../infrastructure/providers/email-campaign-sender.provider";
// import WhatsappCampaignSender from "../../infrastructure/providers/whatsapp-campaign-sender.provider";
import ICampaignSenderStrategy from "../contracts/service/ICampaingSenderStrategy";

export default class CampaignSenderFactory {
    static getSender(channel: string): ICampaignSenderStrategy {
        switch(channel) {
            case 'EMAIL': return new EmailCampaignSender();
            // case 'WHATSAPP': return new WhatsappCampaignSender();
            // case "SMS": return new SmsCampaignSender();
            // case "PUSH": return new PushNotificationSender();

            default: throw new Error(`Tipo de campanha inválida: ${channel}`);
        }
    }
}