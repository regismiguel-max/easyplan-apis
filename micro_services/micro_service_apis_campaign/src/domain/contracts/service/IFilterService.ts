import { ActiveFilterKey, ActiveFiltersValues } from "../../entities/interfaces/email-campaign/filters-to-save.interface";
import { FilterProcessResponse } from "../../entities/interfaces/email-campaign/output/process-filter.interface";

export default interface IFilterService {
  processFiltersToSave(
    campaignId: number, 
    activeFilters: ActiveFilterKey[], 
    activeFiltersValues: ActiveFiltersValues
  ): Promise<FilterProcessResponse>;
}