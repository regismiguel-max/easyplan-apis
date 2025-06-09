import { EmailCampaignStatus } from "../../../types/email-status.types";

export default interface EmailCampaign {
    id?: number | null;
    campaignName: string;
    subject: string;
    status: EmailCampaignStatus;
    emailTemplateId?: number | null;
    // doSchedule: boolean;
    filterByAgeRange: boolean;
    filterByContractStatus: boolean;
    filterByOperator: boolean;
    filterByPlan: boolean;
    filterByUf: boolean;
    filterByValidity: boolean;
    createdAt?: Date | null;
    updatedAt?: Date | null;
}
