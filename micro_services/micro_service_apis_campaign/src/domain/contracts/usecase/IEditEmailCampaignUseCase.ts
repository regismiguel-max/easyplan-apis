import CRUDEmailCampaignDTO from "../../../presentation/dtos/email-campaign/input/crud-email-campaign.dto";
import EditResponse from "../../entities/interfaces/email-campaign/output/edit-response.interface";

export default interface IEditEmailCampaingUseCase {
    execute(dto: CRUDEmailCampaignDTO): Promise<EditResponse>;
}