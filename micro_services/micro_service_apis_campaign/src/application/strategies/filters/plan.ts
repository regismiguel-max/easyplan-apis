import { Op, WhereOptions } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IEmailFiltersRepository from "../../repositories-interfaces/email-filters.repository";
import PlanEmailAssociation from "../../../domain/entities/interfaces/associations/plan-email.interface";

export class PlanFilterStrategy implements IFilterStrategy {
    
    constructor(private emailFiltersRepository: IEmailFiltersRepository) {}

    async save(campaignId: number, ids: number[]): Promise<PlanEmailAssociation[]> {
        return this.emailFiltersRepository.saveEmailPlans(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.emailFiltersRepository.deleteEmailPlans(campaignId);
    }

    async buildWhereClause(ids: number[]): Promise<WhereOptions> {
        const nomePlano = [];
        
        for (const id of ids) {
            const plan = await this.emailFiltersRepository.getPlanById(id);
            nomePlano.push(plan.nome_plano);
        }
        
        return { plano: { [Op.in]: nomePlano } };
    }
}