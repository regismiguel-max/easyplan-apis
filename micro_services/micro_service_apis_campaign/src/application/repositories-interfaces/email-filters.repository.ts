import ContractStatusEmailAssociation from "../../domain/entities/interfaces/associations/contract-status-email.interface";
import OperatorEmailAssociation from "../../domain/entities/interfaces/associations/operator-email.interface";
import PlanEmailAssociation from "../../domain/entities/interfaces/associations/plan-email.interface";
import UfEmailAssociation from "../../domain/entities/interfaces/associations/uf-email.interface";
import AgeRange from "../../domain/entities/interfaces/filters/age-range.interface";
import ContractStatus from "../../domain/entities/interfaces/filters/contract-status.interface";
import Operator from "../../domain/entities/interfaces/filters/operator.interface";
import Plan from "../../domain/entities/interfaces/filters/plan.interface";
import Uf from "../../domain/entities/interfaces/filters/uf.interface";
import Validity from "../../domain/entities/interfaces/filters/validity.interface";

export default interface IEmailFiltersRepository {
    saveEmailOperators(campaignId: number, operatorIds: number[]): Promise<OperatorEmailAssociation[]>;
    saveEmailPlans(campaignId: number, planIds: number[]): Promise<PlanEmailAssociation[]>;
    saveEmailContractStatus(campaignId: number, contractStatusIds: number[]): Promise<ContractStatusEmailAssociation[]>;
    saveEmailModality(campaignId: number, modalityIds: number[]): Promise<any[]>;
    saveEmailUf(campaignId: number, ufIds: number[]): Promise<UfEmailAssociation[]>;
    saveEmailAgeRange(campaignId: number, ageRange: number[]): Promise<AgeRange>;
    saveEmailValidity(campaignId: number, validity: string[]): Promise<Validity>;

    getOperators(): Promise<Operator[]>;
    getOperatorById(id: number): Promise<Operator>;

    getPlans(): Promise<Plan[]>;
    getPlansByOperators(codigo_produto: string): Promise<Plan[]>;
    getPlanById(id: number): Promise<Plan>;
    
    getContractStatuses(): Promise<ContractStatus[]>;
    getContractStatusById(id: number): Promise<ContractStatus>;
    
    getModalities(): Promise<any[]>;
    getModalityById(id: number): Promise<any>;
    
    getUfs(): Promise<Uf[]>;
    getUfById(id: number): Promise<Uf>;

    getAgeRangeById(id: number): Promise<AgeRange>

    getValidityById(id: number): Promise<Validity>

    deleteAllFiltersByCampaignId(emailCampaignId: number): Promise<void>;
    deleteEmailOperators(emailCampaignId: number): Promise<void>;
    deleteEmailPlans(emailCampaignId: number): Promise<string | void>;
    deleteEmailContractStatus(emailCampaignId: number): Promise<string | void>;
    deleteEmailModality(emailCampaignId: number): Promise<string | void>;
    deleteEmailUf(emailCampaignId: number): Promise<string | void>;
    deleteEmailAgeRange(emailCampaignId: number): Promise<string | void>;
    deleteEmailValidity(emailCampaignId: number): Promise<string | void>;
}
  