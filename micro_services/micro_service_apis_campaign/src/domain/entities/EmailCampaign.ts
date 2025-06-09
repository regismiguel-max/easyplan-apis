import { EmailCampaignStatus } from "../types/email-status.types";
// import Schedule from "../value-objects/schedule.valueObjects";
import Filters from "../value-objects/filters.valueObjects";
import DataToSave from "./interfaces/email-campaign/data-to-save.interface";
import EmailCampaignBaseInformations from "../types/email-campaign-create.types";
import FiltersVO from "../value-objects/filters.valueObjects";

// O Domínio deve dizer o que deve e pode ou não fazer com base no seu estado interno
class EmailCampaignEntity {
    public emailCampaignBaseInformations: EmailCampaignBaseInformations;
    public filters: FiltersVO;

    constructor (
        emailCampaingBaseInformations: EmailCampaignBaseInformations,
        filters: FiltersVO
    ) {
        this.emailCampaignBaseInformations = emailCampaingBaseInformations;
        this.filters = filters;
        this.validateCreation();
    }

    public setId(id: number) {
        this.emailCampaignBaseInformations.id = id;
    }

    public assignEmailTemplate(emailTemplateId: number) {
        this.emailCampaignBaseInformations.emailTemplateId = emailTemplateId;
        this.emailCampaignBaseInformations.status = EmailCampaignStatus.PENDING;
    }

    public validateCreation(): boolean {
        if (!this.emailCampaignBaseInformations.campaignName || !this.emailCampaignBaseInformations.subject || !this.emailCampaignBaseInformations.status) {
            throw new Error('Nome, assunto, status são obrigatórios para criar campanha');
        }

        return true;
    }

    public async whatsIShouldSave() {
        console.log('BaseInformations: ', this.emailCampaignBaseInformations);
        console.log('BooleanFiltersFlags: ', this.filters.booleanFiltersFlags);
        console.log('FiltersValues: ', this.filters.filterValues);
        
        let dataToSave: DataToSave = {
            campaign: {
                id: this.emailCampaignBaseInformations.id ?? null,
                campaignName: this.emailCampaignBaseInformations.campaignName,
                subject: this.emailCampaignBaseInformations.subject,
                status: this.emailCampaignBaseInformations.status,
                emailTemplateId: this.emailCampaignBaseInformations.emailTemplateId ?? null,
                // doSchedule: this.filters.booleanFiltersFlags.doSchedule,
                filterByAgeRange: this.filters.booleanFiltersFlags.filterByAgeRange,
                filterByContractStatus: this.filters.booleanFiltersFlags.filterByContractStatus,
                filterByOperator: this.filters.booleanFiltersFlags.filterByOperator,
                filterByPlan: this.filters.booleanFiltersFlags.filterByPlan,
                filterByUf: this.filters.booleanFiltersFlags.filterByUf,
                filterByValidity: this.filters.booleanFiltersFlags.filterByValidity,
            },
            filters: null,
            // schedule: null
        };

        const hasFilter = await this.filters?.hasAnyFilter();

        if(hasFilter) {dataToSave.filters = await this.filters?.getFilterValues();}

        // const isSchedule = this.schedule?.isSchedule();

        // if (isSchedule) {
        //     dataToSave.schedule = this.schedule?.toPrimitives() ?? null;
        // };

        console.log('Retorno final do whatsIShouldSave: ', dataToSave);
        
        return dataToSave;
    }
    
    // pode disparar?
    public async canBeDispatched(): Promise<boolean> {
        if (this.validateCreation() && this.emailCampaignBaseInformations.emailTemplateId && this.emailCampaignBaseInformations.status === EmailCampaignStatus.PENDING) return true;

        return false;
    }

    // public isReadyToDispatch(status: any): boolean {
    //     return !!(
    //         this.campaignName &&
    //         this.subject &&
    //         this.emailTemplateId &&
    //         !(this.status === EmailCampaignStatus.SENT) &&
    //         this.filters?.hasValidRange()
    //     )
    // }

    // Verifica se tem os dados para o agendamento
    // public isSchedulingValid(): boolean {
    //     if (!this.schedule) return true;
    //     return !!(this.schedule.dateSchedule && this.schedule.periodicity);
    // }
    // public updateSchedule(schedule: Schedule) {
    //     if (!this.canBeEdited()) {
    //       throw new Error('Campanha não pode ser editada');
    //     }
    //     this.schedule = schedule;
    // }

    // pode editar?
    
    public canBeEdited(): boolean {
        return !(this.emailCampaignBaseInformations.status === EmailCampaignStatus.SENT);
    }

    public updateFilters(filters: Filters): void {
        if (!this.canBeEdited()) throw new Error('Campanha não pode ser editada');

        this.filters = filters;
    }

    public updateStatus(newStatus: EmailCampaignStatus) {
        this.emailCampaignBaseInformations.status = newStatus;
    }

    public toPrimitives() {
        return {
            id: this.emailCampaignBaseInformations.id,
            campaignName: this.emailCampaignBaseInformations.campaignName,
            subject: this.emailCampaignBaseInformations.subject,
            status: this.emailCampaignBaseInformations.status,
            emailTemplateId: this.emailCampaignBaseInformations.emailTemplateId,
            filters: this.filters
            // schedule: this.schedule?.toPrimitives()
        };
    }
}

export default EmailCampaignEntity;