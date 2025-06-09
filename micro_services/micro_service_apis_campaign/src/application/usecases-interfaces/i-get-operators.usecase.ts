import { Model } from "sequelize";
import Operator from "../../domain/entities/interfaces/filters/operator.interface";

export default interface IGetOperatorsUseCase {
    execute(): Promise<Operator[]>;
    executeById(id: number): Promise<Operator>;
}