import CRUDCampaignDTO from "../../../presentation/dtos/crud-campaign.dto";
import EditResponse from "../../entities/interfaces/email-campaign/output/edit-response.interface";
import { NotRecipient } from "../../entities/interfaces/not-recipient.interface";

export default interface IEditCampaingUseCase {
    execute(dto: CRUDCampaignDTO): Promise<EditResponse | NotRecipient>;
}