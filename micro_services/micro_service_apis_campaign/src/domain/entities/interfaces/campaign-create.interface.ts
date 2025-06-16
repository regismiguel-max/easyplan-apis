import { CampaignStatus } from "../../enums/campaign-status.enum";

export default interface CampaignBaseInformations {
    id?: number;
    campaignName: string;
    subject?: string;
    status: CampaignStatus;
    typeCampaign: string;
    templateId?: number;
}

export interface BooleanFiltersFlags {
  filterByAgeRange: boolean;
  filterByContractStatus: boolean;
  filterByOperator: boolean;
  filterByPlan: boolean;
  filterByUf: boolean;
  filterByValidity: boolean;
  // doSchedule: boolean;
}

export interface FilterValues {
  operator: number[];
  plan: number[];
  contractStatus: number[];
  uf: number[];
  ageRange: [number | null, number | null];
  validity: [string, string];
}
