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
    filterByBirth: boolean;
    filterByDay: boolean;
    filterByMonth: boolean;
    filterByYear: boolean;
    filterByGender: boolean;
    gender: string | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
}
