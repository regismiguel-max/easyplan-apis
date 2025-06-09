import { Op, WhereOptions } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IEmailFiltersRepository from "../../repositories-interfaces/email-filters.repository";
import OperatorEmailAssociation from "../../../domain/entities/interfaces/associations/operator-email.interface";

export class OperatorFilterStrategy implements IFilterStrategy {
    
    constructor(private emailFiltersRepository: IEmailFiltersRepository) {}

    async save(campaignId: number, ids: number[]): Promise<OperatorEmailAssociation[]> {
        return this.emailFiltersRepository.saveEmailOperators(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.emailFiltersRepository.deleteEmailOperators(campaignId);
    }

    async buildWhereClause(ids: number[]): Promise<WhereOptions> {
        const codigoProdutos = [];
        
        for (const id of ids) {
            const operator = await this.emailFiltersRepository.getOperatorById(id);
            codigoProdutos.push(operator.nome_operadora);
        }

        return { operadora: { [Op.in]: codigoProdutos } };
    }
}