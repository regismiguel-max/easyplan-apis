export default interface FailedEmailPayload {
    campaignId: number;
    event: string;
    emailRecipient: string;
}