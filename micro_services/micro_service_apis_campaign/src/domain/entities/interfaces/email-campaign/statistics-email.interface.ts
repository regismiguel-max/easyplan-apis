export default interface StatisticsEmail {
    id: number;
    emailCampaignId: number;
    countsRecipients: number;
    processed: number;
    delivered: number;
    open: number;
    click: number;
    bounce: number;
    dropped: number;
    spam: number;
    unsubscribe: number;
    firstProcessedAt: Date | null;
    lastProcessedAt: Date | null;
    firstDeliveredAt: Date | null;
    lastDeliveredAt: Date | null;
    firstOpenAt: Date | null;
    lastOpenAt: Date | null;
    deliveryRate: number;
    openRate: number;
    createdAt: Date;
    updatedAt: Date    
}