import { Op, WhereOptions } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IEmailFiltersRepository from "../../repositories-interfaces/email-filters.repository";
import UfEmailAssociation from "../../../domain/entities/interfaces/associations/uf-email.interface";

export class UfFilterStrategy implements IFilterStrategy {
    
    constructor(private emailFiltersRepository: IEmailFiltersRepository) {}

    async save(campaignId: number, ids: number[]): Promise<UfEmailAssociation[]> {
        return this.emailFiltersRepository.saveEmailUf(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.emailFiltersRepository.deleteEmailUf(campaignId);
    }

    async buildWhereClause(ids: number[]): Promise<WhereOptions> {
        const estadoUFS = [];
        
        for (const id of ids) {
            const uf = await this.emailFiltersRepository.getUfById(id);
            estadoUFS.push(uf.estadoUF);
        }
        
        return { uf: { [Op.in]: estadoUFS } };
    }
}