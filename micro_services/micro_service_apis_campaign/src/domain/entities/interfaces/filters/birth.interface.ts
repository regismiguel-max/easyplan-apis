export default interface Birth {
    id: number;
    campaignId: number;
    day: number;
    month: string;
    year: number;
    createdAt: Date;
    updatedAt: Date | null;
}