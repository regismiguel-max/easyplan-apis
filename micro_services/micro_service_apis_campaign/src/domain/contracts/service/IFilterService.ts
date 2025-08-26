import { ActiveFilterKey, ActiveFiltersValues } from "../../entities/interfaces/filters-to-save.interface";
import { FilterProcessBuildVerificationResponse, FilterProcessResponse } from "../../entities/interfaces/email-campaign/output/process-filter.interface";

export default interface IFilterService {
  processFiltersToSave(
    campaignId: number, 
    activeFilters: ActiveFilterKey[], 
    activeFiltersValues: ActiveFiltersValues,
    persistenceData?: boolean
  ): Promise<FilterProcessResponse>;

  processFiltersToEdit(
    campaignId: number, 
    activeFilters: ActiveFilterKey[], 
    activeFiltersValues: ActiveFiltersValues,
    diffs: {key: string, value: boolean}[],
    persistenceData?: boolean
  ): Promise<FilterProcessResponse>;

  processToBuildVerificationIfHasBeneficiary(
    activeFilters: ActiveFilterKey[],
    activeFiltersValues: ActiveFiltersValues
  ): Promise<FilterProcessBuildVerificationResponse>
}