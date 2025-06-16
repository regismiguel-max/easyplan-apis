import { Periodicity } from "../../enums/email-periodicity.enum";

export default interface Schedule {
    dateSchedule: string;
    periodicity: Periodicity;
}