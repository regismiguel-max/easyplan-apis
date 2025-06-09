import EmailFiltersRepository from "../../../infrastructure/repositories/email-filters.repository";
import { Model } from "sequelize";
import IGetUfsUseCase from "../../usecases-interfaces/i-get-ufs.usecase";
import Uf from "../../../domain/entities/interfaces/filters/uf.interface";


export default class GetUfsUseCase implements IGetUfsUseCase {

    constructor(
        private emailFiltersRepository: EmailFiltersRepository
    ) {}

    public async execute(): Promise<Uf[]> {
        const ufs = await this.emailFiltersRepository.getUfs();

        return ufs;
    }
}