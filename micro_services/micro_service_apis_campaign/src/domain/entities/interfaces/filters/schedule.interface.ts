export default interface Schedule {
    id: number;
    scheduleDate: Date;
    periodicity: string;
    emailCampaignId: number;
    createdAt: Date;
    updatedAt: Date;
}
