import CRUDCampaignDTO from "../../../presentation/dtos/crud-campaign.dto";
import Campaign from "../../entities/interfaces/campaign.interface";

interface ISaveCampaignUseCase {
    execute(dto: CRUDCampaignDTO): Promise<Campaign>;
}

export default ISaveCampaignUseCase;