import { EmailCampaignStatus } from "./email-status.types";

export default interface EmailCampaignBaseInformations {
    id: number | null;
    campaignName: string;
    subject: string;
    status: EmailCampaignStatus;
    emailTemplateId: number | null;
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
  operator: number[] | [];
  plan: number[] | [];
  contractStatus: number[] | [];
  uf: number[] | [];
  ageRange: number[] | [];
  validity: string[] | [];
}
