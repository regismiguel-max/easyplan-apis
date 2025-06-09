import IGetOperatorsUseCase from "../../usecases-interfaces/i-get-operators.usecase";
// import OperatorsModel from "../../../infrastructure/repositories/models/operators.models";
import EmailFiltersRepository from "../../../infrastructure/repositories/email-filters.repository";
import { Model } from "sequelize";
import Operator from "../../../domain/entities/interfaces/filters/operator.interface";

export default class GetOperatorsUseCase implements IGetOperatorsUseCase {
    constructor(
        private emailFiltersRepository: EmailFiltersRepository
    ) {}

    public async execute(): Promise<Operator[]> {
        const operators = await this.emailFiltersRepository.getOperators();

        return operators;
    }

    public async executeById(id: number): Promise<Operator> {
        if(!id) throw new Error('Caso de uso não recebeu o id para realizar a devida busca');
        
        const operator = await this.emailFiltersRepository.getOperatorById(id);

        return operator;
    }
}