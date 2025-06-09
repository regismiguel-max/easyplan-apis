import CRUDEmailCampaignDTO from "../../../presentation/dtos/email-campaign/input/crud-email-campaign.dto";

export default interface IDeleteEmailCampaignUseCase {
    execute(id: number): Promise<string>;
}