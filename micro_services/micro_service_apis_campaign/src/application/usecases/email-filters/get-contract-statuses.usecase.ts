import EmailFiltersRepository from "../../../infrastructure/repositories/email-filters.repository";
import { Model } from "sequelize";
import IGetContractStatusesUseCase from "../../usecases-interfaces/i-get-contract-statuses.usecase";
import ContractStatus from "../../../domain/entities/interfaces/filters/contract-status.interface";

export default class GetContractStatusesUseCase implements IGetContractStatusesUseCase {

    constructor(
        private emailFiltersRepository: EmailFiltersRepository
    ) {}

    public async execute(): Promise<ContractStatus[]> {
        const contractStatuses = await this.emailFiltersRepository.getContractStatuses();

        return contractStatuses;
    }
}