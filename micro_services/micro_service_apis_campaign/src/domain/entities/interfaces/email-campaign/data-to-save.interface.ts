import EmailCampaign from "./email-campaign.interface";
import FiltersToSave from "./filters-to-save.interface";
import Schedule from "./schedule-to-save.interface";

export default interface DataToSave {
    campaign: EmailCampaign
    filters: FiltersToSave | null;
    // schedule: Schedule | null;
}