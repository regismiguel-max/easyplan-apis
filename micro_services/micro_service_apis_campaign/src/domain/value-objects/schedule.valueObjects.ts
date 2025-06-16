import { Periodicity } from "../enums/email-periodicity.enum";

export default class Schedule {
    public readonly doSchedule: boolean;
    public readonly dateSchedule!: Date;
    public readonly periodicity!: Periodicity;

    constructor(
        doSchedule: boolean,
        dateSchedule: Date,
        periodicity: Periodicity
    ) {
        this.doSchedule = doSchedule;

        if (this.doSchedule) {
            if (!dateSchedule || isNaN(dateSchedule.getTime())) {
                throw new Error('Data de agendamento inválida');
            }
          
            if (!periodicity || !Object.values(Periodicity).includes(periodicity)) {
                throw new Error('Periodicidade inválida');
            }

            this.dateSchedule = dateSchedule;
            this.periodicity = periodicity;
        }
    }

    public isSchedule(): boolean {
        return this.doSchedule;
    }

    public toPrimitives() {
        if (!this.doSchedule) return null;      
            
        return {
            dateSchedule: this.dateSchedule.toISOString(),
            periodicity: this.periodicity
        };
    }
}
