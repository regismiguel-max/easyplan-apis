export default interface IDeleteCampaignUseCase {
    execute(id: number): Promise<string>;
}