import Campaign from "./campaign.interface";
import FiltersToSave from "./filters-to-save.interface";
import Schedule from "./schedule-to-save.interface";

export default interface DataToSave {
    campaign: Campaign
    filters: FiltersToSave | null;
    // schedule: Schedule | null;
}