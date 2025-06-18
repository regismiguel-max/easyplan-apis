export default interface StaticticsWhatsapp {
    id: number;
    campaignId: number;
    sent: boolean;
    failed: number; //qual tipo?
    sentRate: number;
    countsRecipients: number;
    createdAt: Date;
    updatedAt: Date   
}