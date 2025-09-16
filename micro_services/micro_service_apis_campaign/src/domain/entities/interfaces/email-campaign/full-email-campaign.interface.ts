import AgeRange from "../filters/age-range.interface";
import ContractStatus from "../filters/contract-status.interface";
import Operator from "../filters/operator.interface";
import Plan from "../filters/plan.interface";
import Schedule from "../filters/schedule.interface";
import Uf from "../filters/uf.interface";
import Validity from "../filters/validity.interface";
import Campaign from "../campaign.interface";
import Template from "../template.interface";
import StatisticsEmail from "./statistics-email.interface";
import StaticticsWhatsapp from "../whats-campaign/statistics-whatsapp.interface";
import Birth from "../filters/birth.interface";
import RecipientGroup from "../recipient-group.interface";

export default interface ShortFullEmailCampaign {
    campaign: Campaign,
    campaignTemplateModel?: Template | null,
    statisticsEmailCampaign?: StatisticsEmail | null,
    emailSchedule?: Schedule | null,
    ageRange?: AgeRange | null,
    operators?: Operator[] | null,
    plans?: Plan[] | null,
    contractStatuses?: ContractStatus[] | null,
    validity?: Validity | null,
    ufs?: Uf[] | null,
    whatsappStatisticsModel: StaticticsWhatsapp,
    birth?: Birth,
    recipientGroup?: RecipientGroup[],
}


