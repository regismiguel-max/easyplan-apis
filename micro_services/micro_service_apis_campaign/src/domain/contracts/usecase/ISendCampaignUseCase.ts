import CRUDEmailCampaignDTO from "../../../presentation/dtos/email-campaign/input/crud-email-campaign.dto";

export default interface ISendCampaignUseCase {
    execute(dto: CRUDEmailCampaignDTO): Promise<void | string>;
}