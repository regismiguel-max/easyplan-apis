export default interface IDeleteCampaignUseCase {
    execute(id: number, typeCampaign: string): Promise<string>;
}