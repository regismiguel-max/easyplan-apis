import { IsEnum, IsInstance, IsOptional, IsString } from "class-validator";
import EmailCampaignEntity from "../../../../domain/entities/EmailCampaign";
import { EmailCampaignStatus } from "../../../../domain/types/email-status.types";
import { Periodicity } from "../../../../domain/enums/email-periodicity.types";
import Schedule from "../../../../domain/value-objects/schedule.valueObjects";
import Filters from "../../../../domain/value-objects/filters.valueObjects";
import EmailCampaignBaseInformations, { BooleanFiltersFlags, FilterValues } from "../../../../domain/types/email-campaign-create.types";

class CRUDEmailCampaignDTO {
  // @IsInstance()
  public emailCampaignBaseInformations: EmailCampaignBaseInformations;
  
  // @IsInstance()
  public booleansFiltersFlags: BooleanFiltersFlags;
  
  // @IsInstance()
  public filtersValues: FilterValues;

  public channel?: string;


  constructor(data: CRUDEmailCampaignDTO) {
    this.emailCampaignBaseInformations = data.emailCampaignBaseInformations;
    this.booleansFiltersFlags = data.booleansFiltersFlags;
    this.filtersValues = data.filtersValues;

    if(data.channel) this.channel = data.channel;
  }
}

export default CRUDEmailCampaignDTO;
