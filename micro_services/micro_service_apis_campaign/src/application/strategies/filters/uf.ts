import { Op, WhereOptions } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IFiltersRepository from "../../../domain/contracts/repositories/IFiltersRepository";
import UfEmailAssociation from "../../../domain/entities/interfaces/associations/uf-email.interface";

export class UfFilterStrategy implements IFilterStrategy {
    
    constructor(private filtersRepository: IFiltersRepository) {}

    async save(campaignId: number, ids: number[]): Promise<UfEmailAssociation[]> {
        return this.filtersRepository.saveCampaignUf(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.filtersRepository.deleteCampaignUf(campaignId);
    }

    async buildWhereClause(ids: number[]): Promise<WhereOptions> {
        const estadoUFS = [];
        
        for (const id of ids) {
            const uf = await this.filtersRepository.getUfById(id);
            estadoUFS.push(uf.estadoUF);
        }
        
        return { uf: { [Op.in]: estadoUFS } };
    }

    async pureBuildWhereClause(ids: number[]): Promise<WhereOptions> {
        const estadoUFS = [];
        
        for (const id of ids) {
            const uf = await this.filtersRepository.getUfById(id);
            estadoUFS.push(uf.estadoUF);
        }
        
        return { uf: { [Op.in]: estadoUFS } };
    }

    getLabel(): string {
        return 'Uf';
    }
}