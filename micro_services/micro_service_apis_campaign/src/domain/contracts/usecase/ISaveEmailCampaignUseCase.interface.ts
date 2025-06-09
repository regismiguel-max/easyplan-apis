import CRUDEmailCampaignDTO from "../../../presentation/dtos/email-campaign/input/crud-email-campaign.dto";
import SaveResponse from "../../entities/interfaces/email-campaign/output/save-response.interface";
interface ISaveEmailCampaignUseCase {
    execute(dto: CRUDEmailCampaignDTO): Promise<SaveResponse>;
}

export default ISaveEmailCampaignUseCase;