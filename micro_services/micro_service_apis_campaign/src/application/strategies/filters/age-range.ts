import { Op, WhereOptions } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IFiltersRepository from "../../../domain/contracts/repositories/IFiltersRepository";
import AgeRange from "../../../domain/entities/interfaces/filters/age-range.interface";
import Validity from "../../../domain/entities/interfaces/filters/validity.interface";

export class AgeRangeFilterStrategy implements IFilterStrategy {
    
    constructor(private filtersRepository: IFiltersRepository) {}

    async save(campaignId: number, ids: number[]): Promise<AgeRange> {
        return this.filtersRepository.saveCampaignAgeRange(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.filtersRepository.deleteCampaignAgeRange(campaignId);
    }

    async buildWhereClause(id: number): Promise<WhereOptions> {
        const ageRange = [];
        
        const ageRangeDB = await this.filtersRepository.getAgeRangeById(id);

        ageRange.push(ageRangeDB.min);
        ageRange.push(ageRangeDB.max);
        
        return { idade: { [Op.between]: [ageRange[0], ageRange[1]] } };
    }

    async pureBuildWhereClause(ageRangeFilterValues: [number, number]): Promise<WhereOptions> {
        return { idade: { [Op.between]: [ageRangeFilterValues[0], ageRangeFilterValues[1]] } };
    }

    getLabel(): string {
        return 'Faixa Etária';
    }
}