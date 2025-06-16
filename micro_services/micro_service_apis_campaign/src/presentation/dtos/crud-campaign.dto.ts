import CampaignBaseInformations, { BooleanFiltersFlags, FilterValues } from "../../domain/entities/interfaces/campaign-create.interface";

class CRUDCampaignDTO {
  // @IsInstance()
  public campaignBaseInformations: CampaignBaseInformations;
  
  // @IsInstance()
  public booleansFiltersFlags: BooleanFiltersFlags;
  
  // @IsInstance()
  public filtersValues: FilterValues;

  public channel: string;


  constructor(data: CRUDCampaignDTO) {
    this.campaignBaseInformations = data.campaignBaseInformations;
    this.booleansFiltersFlags = data.booleansFiltersFlags;
    this.filtersValues = data.filtersValues;

    this.channel = data.channel;
  }
}

export default CRUDCampaignDTO;
