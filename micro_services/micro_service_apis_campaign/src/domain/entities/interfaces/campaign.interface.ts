import { CampaignStatus } from "../../enums/campaign-status.enum";

export default interface Campaign {
    id?: number | null;
    campaignName: string;
    subject?: string;
    status: CampaignStatus;
    typeCampaign: string;
    templateId?: number | null;
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
