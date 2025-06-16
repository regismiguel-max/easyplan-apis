import filtersRepository from "../../../infrastructure/repositories/filters.repository";
import { Model } from "sequelize";
import IGetUfsUseCase from "../../usecases-interfaces/i-get-ufs.usecase";
import Uf from "../../../domain/entities/interfaces/filters/uf.interface";


export default class GetUfsUseCase implements IGetUfsUseCase {

    constructor(
        private filtersRepository: filtersRepository
    ) {}

    public async execute(): Promise<Uf[]> {
        const ufs = await this.filtersRepository.getUfs();

        return ufs;
    }
}