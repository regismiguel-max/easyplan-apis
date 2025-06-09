import { Model } from "sequelize";
import ContractStatus from "../../domain/entities/interfaces/filters/contract-status.interface";

export default interface IGetContractStatusesUseCase {
    execute(): Promise<ContractStatus[]>;
}