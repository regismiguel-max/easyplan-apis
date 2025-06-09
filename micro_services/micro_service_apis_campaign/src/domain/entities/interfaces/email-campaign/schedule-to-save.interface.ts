import { Periodicity } from "../../../enums/email-periodicity.types";

export default interface Schedule {
    dateSchedule: string;
    periodicity: Periodicity;
}