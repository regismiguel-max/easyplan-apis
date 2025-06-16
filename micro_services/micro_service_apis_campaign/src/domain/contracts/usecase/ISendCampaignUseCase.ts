import CRUDCampaignDTO from "../../../presentation/dtos/crud-campaign.dto";

export default interface ISendCampaignUseCase {
    execute(dto: CRUDCampaignDTO): Promise<void | string>;
}