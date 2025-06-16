import filtersRepository from "../../../infrastructure/repositories/filters.repository";
import { Model } from "sequelize";
import IGetPlansUseCase from "../../usecases-interfaces/i-get-plans.usecase";
import Plan from "../../../domain/entities/interfaces/filters/plan.interface";

export default class GetPlansUseCase implements IGetPlansUseCase {
    constructor(
        private filtersRepository: filtersRepository
    ) {}

    public async execute(): Promise<Plan[]> {
        const plans = await this.filtersRepository.getPlans();

        return plans;
    }

    public async executeByOperators(codigo_produto: string): Promise<Plan[]> {
        const plansByOperators: Plan[] = await this.filtersRepository.getPlansByOperators(codigo_produto);

        return plansByOperators;
    }
}