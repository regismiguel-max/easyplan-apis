import Campaign from "../../entities/interfaces/campaign.interface";
export default interface IGetAllCampaignsUseCase {
    execute(typeCampaign: string): Promise<Campaign[]>;
}