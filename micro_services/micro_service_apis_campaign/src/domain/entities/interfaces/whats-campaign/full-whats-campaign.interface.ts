import { CampaignStatus } from "../../../enums/campaign-status.enum";
import AgeRange from "../filters/age-range.interface";
import ContractStatus from "../filters/contract-status.interface";
import Operator from "../filters/operator.interface";
import Plan from "../filters/plan.interface";
import Uf from "../filters/uf.interface";
import Validity from "../filters/validity.interface";
import WhatsTemplate from "./whats-template.interface";

export default interface FullEmailCampaign {
    id: number;
    campaignName: string;
    subject: string;
    status: CampaignStatus;
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
    whatsTemplateModel?: WhatsTemplate | null,
    // statisticsEmailCampaign?: StatisticsEmail | null,
    // emailSchedule?: Schedule | null,
    ageRange?: AgeRange | null,
    operators?: Operator[] | null,
    plans?: Plan[] | null,
    contractStatuses?: ContractStatus[] | null,
    validity?: Validity | null,
    ufs?: Uf[] | null,
}