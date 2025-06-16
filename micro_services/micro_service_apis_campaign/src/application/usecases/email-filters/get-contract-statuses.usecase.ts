import filtersRepository from "../../../infrastructure/repositories/filters.repository";
import { Model } from "sequelize";
import IGetContractStatusesUseCase from "../../usecases-interfaces/i-get-contract-statuses.usecase";
import ContractStatus from "../../../domain/entities/interfaces/filters/contract-status.interface";

export default class GetContractStatusesUseCase implements IGetContractStatusesUseCase {

    constructor(
        private filtersRepository: filtersRepository
    ) {}

    public async execute(): Promise<ContractStatus[]> {
        const contractStatuses = await this.filtersRepository.getContractStatuses();

        return contractStatuses;
    }
}