import { Op, WhereOptions } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IFiltersRepository from "../../../domain/contracts/repositories/IFiltersRepository";
import OperatorEmailAssociation from "../../../domain/entities/interfaces/associations/operator-email.interface";

export class OperatorFilterStrategy implements IFilterStrategy {
    
    constructor(private filtersRepository: IFiltersRepository) {}

    async save(campaignId: number, ids: number[]): Promise<OperatorEmailAssociation[]> {
        return this.filtersRepository.saveCampaignOperators(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.filtersRepository.deleteCampaignOperators(campaignId);
    }

    async buildWhereClause(ids: number[]): Promise<WhereOptions> {
        const codigoProdutos = [];
        
        for (const id of ids) {
            const operator = await this.filtersRepository.getOperatorById(id);
            codigoProdutos.push(operator.nome_operadora);
        }

        return { operadora: { [Op.in]: codigoProdutos } };
    }
}