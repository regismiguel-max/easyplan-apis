export default interface ReportEmail {
    id: number;
    campaignId: number;
    emailRecipient: string;
    sent_date: string;
    open_date: string;
    click_date: string;
    ip: string;
}