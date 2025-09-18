export default interface FailedEmailPayload {
    id: number;
    campaignId: number;
    event: string;
    emailRecipient: string;
    reason: string;
    createdAt: Date;
    updatedAt: Date;
}