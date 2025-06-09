import { EmailCampaignStatus } from "../../../types/email-status.types";
import AgeRange from "../filters/age-range.interface";
import ContractStatus from "../filters/contract-status.interface";
import Operator from "../filters/operator.interface";
import Plan from "../filters/plan.interface";
import Schedule from "../filters/schedule.interface";
import Uf from "../filters/uf.interface";
import Validity from "../filters/validity.interface";
import EmailCampaign from "./email-campaign.interface";
import EmailTemplate from "./email-template.interface";
import StatisticsEmail from "./statistics-email.interface";

export default interface FullEmailCampaign {
    id: number;
    campaignName: string;
    subject: string;
    status: EmailCampaignStatus;
    emailTemplateId?: number | null;
    // doSchedule: boolean | null;
    filterByAgeRange: boolean;
    filterByContractStatus: boolean;
    filterByOperator: boolean;
    filterByPlan: boolean;
    filterByUf: boolean;
    filterByValidity: boolean;
    createdAt: Date;
    updatedAt: Date | null;
    emailTemplateModel?: EmailTemplate | null,
    statisticsEmailCampaign?: StatisticsEmail | null,
    emailSchedule?: Schedule | null,
    ageRange?: AgeRange | null,
    operators?: Operator[] | null,
    plans?: Plan[] | null,
    contractStatuses?: ContractStatus[] | null,
    validity?: Validity | null,
    ufs?: Uf[] | null,
}

export interface ShortFullEmailCampaign {
    emailCampaign: EmailCampaign,
    emailTemplateModel?: EmailTemplate | null,
    statisticsEmailCampaign?: StatisticsEmail | null,
    emailSchedule?: Schedule | null,
    ageRange?: AgeRange | null,
    operators?: Operator[] | null,
    plans?: Plan[] | null,
    contractStatuses?: ContractStatus[] | null,
    validity?: Validity | null,
    ufs?: Uf[] | null,
}


