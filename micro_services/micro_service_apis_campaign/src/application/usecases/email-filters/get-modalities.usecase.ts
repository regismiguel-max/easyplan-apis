import filtersRepository from "../../../infrastructure/repositories/filters.repository";
import { Model } from "sequelize";
import IGetModalitiesUseCase from "../../usecases-interfaces/i-get-modalities.usecase";


export default class GetModalitiesUseCase implements IGetModalitiesUseCase {

    constructor(
        private filtersRepository: filtersRepository
    ) {}

    public async execute(): Promise<Model<any, any>[]> {
        console.log('Modalities - Entrei no caso de uso');
        
        const modalities = await this.filtersRepository.getModalities();

        // console.log('Modalities - Resultado do repository: ', modalities);
        console.log('Modalities - Resultado do repository: ');

        return modalities;
    }
}