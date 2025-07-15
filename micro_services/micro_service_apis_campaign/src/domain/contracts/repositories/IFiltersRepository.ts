import ContractStatusEmailAssociation from "../../entities/interfaces/associations/contract-status-email.interface";
import OperatorEmailAssociation from "../../entities/interfaces/associations/operator-email.interface";
import PlanEmailAssociation from "../../entities/interfaces/associations/plan-email.interface";
import UfEmailAssociation from "../../entities/interfaces/associations/uf-email.interface";
import BirthDTOPersistence from "../../entities/interfaces/birth-dto-persistence.interface";
import AgeRange from "../../entities/interfaces/filters/age-range.interface";
import Birth from "../../entities/interfaces/filters/birth.interface";
import ContractStatus from "../../entities/interfaces/filters/contract-status.interface";
import Operator from "../../entities/interfaces/filters/operator.interface";
import Plan from "../../entities/interfaces/filters/plan.interface";
import Uf from "../../entities/interfaces/filters/uf.interface";
import Validity from "../../entities/interfaces/filters/validity.interface";

export default interface IFiltersRepository {
    saveCampaignOperators(campaignId: number, operatorIds: number[]): Promise<OperatorEmailAssociation[]>;
    saveCampaignBirth(campaignId: number, birthDatas: BirthDTOPersistence): Promise<Birth>
    saveCampaignPlans(campaignId: number, planIds: number[]): Promise<PlanEmailAssociation[]>;
    saveCampaignContractStatus(campaignId: number, contractStatusIds: number[]): Promise<ContractStatusEmailAssociation[]>;
    saveCampaignModality(campaignId: number, modalityIds: number[]): Promise<any[]>;
    saveCampaignUf(campaignId: number, ufIds: number[]): Promise<UfEmailAssociation[]>;
    saveCampaignAgeRange(campaignId: number, ageRange: number[]): Promise<AgeRange>;
    saveCampaignValidity(campaignId: number, validity: string[]): Promise<Validity>;

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

    getBirthById(id: number): Promise<Birth>

    deleteAllFiltersByCampaignId(campaignId: number): Promise<void>;
    deleteCampaignOperators(campaignId: number): Promise<void>;
    deleteCampaignPlans(campaignId: number): Promise<string | void>;
    deleteCampaignContractStatus(campaignId: number): Promise<string | void>;
    deleteCampaignModality(campaignId: number): Promise<string | void>;
    deleteCampaignUf(campaignId: number): Promise<string | void>;
    deleteCampaignAgeRange(campaignId: number): Promise<string | void>;
    deleteCampaignBirth(campaignId: number): Promise<string | void>
    deleteCampaignValidity(campaignId: number): Promise<string | void>;
}
  