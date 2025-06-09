export default interface SendEmailDTO {
    baseData: BaseDataToSend;
    template: string;
    recipientGroup: string[];
    channel: string | null;
    recipientsGroupCount: number;
    chunkIndex: number;
    totalChunks: number;
}

export interface BaseDataToSend {
    id: number;
    campaignName: string;
    subject: string;
    status: string
}