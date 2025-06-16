import axios from "axios";
import ICampaignSenderStrategy from "../../domain/contracts/service/ICampaingSenderStrategy";
import { SendWhatsappCampaignDTO } from "../../domain/entities/interfaces/send-data.interface";
// import { response } from "express";
import * as dotenv from "dotenv";
dotenv.config();
export type Payload = {
    number: number,
    idMessage: number,
    chunkIndex?: number,
    campaignId?: number
}
export default class WhatsappCampaignSender implements ICampaignSenderStrategy {
    public kaulizApiKey = process.env.CAMPAIGN_KAULIZ_API_KEY as string;
    public kaulizURL = process.env.CAMPAIGN_KAULIZ_URL_MESSAGE_TO_SEND as string;

    constructor() {}

    public async senderCampaing(data: SendWhatsappCampaignDTO) {
        const messagesKauliz = data.recipientGroup.map((rg) => {
            return {
                number: rg,
                country: "+55",
                text: data.template,
                campaignName: data.baseData.campaignName,
                extFlag: 1,
                hidden: false,
            }
        });

        console.log('Veja a messagem final para o KAULIZ: ', messagesKauliz);

        let payloads: Payload[] = [];

        for(const messageKauliz of messagesKauliz) {
            try {
                const response = await axios.post(
                    this.kaulizURL,
                    {
                        "queueId": 20,
                        "apiKey": this.kaulizApiKey,
                        "number": messageKauliz.number,
                        "country": messageKauliz.country,
                        "text": messageKauliz.text,
                        "campaignName": messageKauliz.campaignName,
                        "extFlag": messageKauliz.extFlag,
                        "hidden": false,
                    }
                );
    
                // console.log('Resposta do KAULIZ: ', response);
                console.log('Resposta do KAULIZ: ', response.data);
                    
                type enqueued = { message: string, enqueuedId: number };
                const enqueuedIdObject: enqueued = response.data;
                const idMessage = enqueuedIdObject.enqueuedId;
                    
                const payload: Payload = {
                    number: messageKauliz.number,
                    idMessage
                }
    
                payloads.push(payload);
                // const idsToStatusConsult: number[] = enqueuedIds.map((id) => id.enqueuedId );
                // console.log('ids no sender: ', idsToStatusConsult);
            } catch (error: any) {
                console.log('Error do KAULIZ: ', error);
                return {
                    success: false,
                    statusCode: error.status,
                    whatsappSent: messagesKauliz.length,
                };
            }
        }

        console.log('Payload final: ', payloads);
        

        return {
            success: true,
            typeCampaign: 'whatsapp',
            idsStatus: payloads,
            statusCode: 200,
            campaignSents: messagesKauliz.length,
        };
    }
}