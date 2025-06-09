import EmailFiltersRepository from "../../../infrastructure/repositories/email-filters.repository";
import { Model } from "sequelize";
import IGetPlansUseCase from "../../usecases-interfaces/i-get-plans.usecase";
import Plan from "../../../domain/entities/interfaces/filters/plan.interface";

export default class GetPlansUseCase implements IGetPlansUseCase {
    constructor(
        private emailFiltersRepository: EmailFiltersRepository
    ) {}

    public async execute(): Promise<Plan[]> {
        const plans = await this.emailFiltersRepository.getPlans();

        return plans;
    }

    public async executeByOperators(codigo_produto: string): Promise<Plan[]> {
        const plansByOperators: Plan[] = await this.emailFiltersRepository.getPlansByOperators(codigo_produto);

        return plansByOperators;
    }
}