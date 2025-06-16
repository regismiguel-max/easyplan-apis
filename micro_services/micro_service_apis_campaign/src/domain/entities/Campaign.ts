import { CampaignStatus } from "../enums/campaign-status.enum";
import FiltersVO from "../value-objects/filters.valueObjects";
import CampaignBaseInformations from "./interfaces/campaign-create.interface";
import DataToSave from "./interfaces/data-to-save.interface";

export default class CampaignEntity {
    public baseInformations: CampaignBaseInformations;
    public filters: FiltersVO;
    public typeCampaign: string;

    constructor(baseInformations: CampaignBaseInformations, filters: FiltersVO, typeCampaign: string){
        this.baseInformations = baseInformations;
        this.filters = filters;
        this.typeCampaign = typeCampaign;
        
        this.validateCreation();
    }

    public validateCreation(): boolean {
        if(!this.baseInformations.typeCampaign) throw new Error('Campanha sem definição do tipo');

        if(this.baseInformations.typeCampaign === 'email') {
            if (!this.baseInformations.campaignName || !this.baseInformations.subject || !this.baseInformations.status) {
                throw new Error('Nome, assunto, status são obrigatórios para criar campanha de e-mail');
            }

            return true
        } else if(this.typeCampaign === 'whatsapp'){
            if (!this.baseInformations.campaignName || !this.baseInformations.status) {
                throw new Error('Nome e status são obrigatórios para criar campanha d whatsapp');
            }
            
            return true;
        } else {
            throw new Error('Não reconhecemos o tipo da campanha')
        }
    }

    public setId(id: number) {
        this.baseInformations.id = id;
    }
    
    public assignEmailTemplate(whatsTemplateId: number) {
        this.baseInformations.templateId = whatsTemplateId;
        this.baseInformations.status = CampaignStatus.PENDING;
    }
    
    public async whatsIShouldSave() {
        console.log('BaseInformations: ', this.baseInformations);
        console.log('BooleanFiltersFlags: ', this.filters.booleanFiltersFlags);
        console.log('FiltersValues: ', this.filters.filterValues);
            
        let dataToSave: DataToSave = {
            campaign: {
                id: this.baseInformations.id ?? null,
                campaignName: this.baseInformations.campaignName,
                subject: this.baseInformations.subject ?? undefined,
                status: this.baseInformations.status,
                typeCampaign: this.baseInformations.typeCampaign,
                templateId: this.baseInformations.templateId ?? null,
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
        if (this.validateCreation() && this.baseInformations.templateId && this.baseInformations.status === CampaignStatus.PENDING) return true;
    
        return false;
    }

    public canBeEdited(): boolean {
        return !(this.baseInformations.status === CampaignStatus.SENT);
    }
    
    public updateFilters(filters: FiltersVO): void {
        if (!this.canBeEdited()) throw new Error('Campanha não pode ser editada');
    
        this.filters = filters;
    }
    
    public updateStatus(newStatus: CampaignStatus) {
            this.baseInformations.status = newStatus;
    }
    
    public toPrimitives() {
        return {
            id: this.baseInformations.id ?? undefined,
            campaignName: this.baseInformations.campaignName,
            subject: this.baseInformations.subject ?? undefined,
            status: this.baseInformations.status,
            templateId: this.baseInformations.templateId ?? undefined,
            filters: this.filters
            // schedule: this.schedule?.toPrimitives()
        };
    }
}