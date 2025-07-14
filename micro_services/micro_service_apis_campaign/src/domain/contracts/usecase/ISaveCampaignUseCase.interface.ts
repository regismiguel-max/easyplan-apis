import CRUDCampaignDTO from "../../../presentation/dtos/crud-campaign.dto";
import Campaign from "../../entities/interfaces/campaign.interface";
import { NotRecipient } from "../../entities/interfaces/not-recipient.interface";

interface ISaveCampaignUseCase {
    execute(dto: CRUDCampaignDTO): Promise<Campaign | NotRecipient>;
}

export default ISaveCampaignUseCase;