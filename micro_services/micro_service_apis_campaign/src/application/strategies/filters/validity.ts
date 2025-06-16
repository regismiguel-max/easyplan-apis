import { Op, WhereOptions } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IFiltersRepository from "../../../domain/contracts/repositories/IFiltersRepository";
import Validity from "../../../domain/entities/interfaces/filters/validity.interface";

export class ValidityFilterStrategy implements IFilterStrategy {
    
    constructor(private filtersRepository: IFiltersRepository) {}

    async save(campaignId: number, ids: string[]): Promise<Validity> {
        return this.filtersRepository.saveCampaignValidity(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.filtersRepository.deleteCampaignValidity(campaignId);
    }

    async buildWhereClause(id: number): Promise<WhereOptions> {
        const validityRange = [];
        
        const validity = await this.filtersRepository.getValidityById(id);

        const start = validity.start.toISOString().split('T')[0];
        const end = validity.end.toISOString().split('T')[0];

        validityRange.push(start);
        validityRange.push(end);
        
        return { vigencia: { [Op.between]: validityRange } };
    }
}