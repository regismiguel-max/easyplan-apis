export interface SendEmailCampaignDTO {
    baseData: BaseDataToSend;
    template: string;
    recipientGroup: string[];
    channel: string | null;
    recipientsGroupCount: number;
    chunkIndex: number;
    totalChunks: number;
}

export interface SendWhatsappCampaignDTO {
    baseData: BaseDataToSend;
    template: string;
    imageId?: number;
    recipientGroup: number[];
    channel: string | null;
    recipientsGroupCount: number;
    chunkIndex: number;
    totalChunks: number;
}

export interface BaseDataToSend {
    id: number;
    campaignName: string;
    subject?: string;
    status: string;
    typeCampaign: string;
}

export type SendCampaignDTO = SendEmailCampaignDTO | SendWhatsappCampaignDTO;