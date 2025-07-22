import { Op, WhereOptions } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IFiltersRepository from "../../../domain/contracts/repositories/IFiltersRepository";
import PlanEmailAssociation from "../../../domain/entities/interfaces/associations/plan-email.interface";

export class PlanFilterStrategy implements IFilterStrategy {
    
    constructor(private filtersRepository: IFiltersRepository) {}

    async save(campaignId: number, ids: number[]): Promise<PlanEmailAssociation[]> {
        return this.filtersRepository.saveCampaignPlans(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.filtersRepository.deleteCampaignPlans(campaignId);
    }

    async buildWhereClause(ids: number[]): Promise<WhereOptions> {
        const nomePlano = [];
        
        for (const id of ids) {
            const plan = await this.filtersRepository.getPlanById(id);
            nomePlano.push(plan.nome_plano);
        }
        
        return { plano: { [Op.in]: nomePlano } };
    }

    async pureBuildWhereClause(ids: number[]): Promise<WhereOptions> {
        const nomePlano = [];
        
        for (const id of ids) {
            const plan = await this.filtersRepository.getPlanById(id);
            nomePlano.push(plan.nome_plano);
        }
        
        return { plano: { [Op.in]: nomePlano } };
    }

    getLabel(): string {
        return 'Plano';
    }
}