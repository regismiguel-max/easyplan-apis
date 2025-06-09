export default interface IEmailScheduleRepository {
    save(email_campaign_id: number, data: {
      dateSchedule: string;
      periodicity: string;
    }): Promise<void>;
}