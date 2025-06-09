import { Op, WhereOptions } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IEmailFiltersRepository from "../../repositories-interfaces/email-filters.repository";
import AgeRange from "../../../domain/entities/interfaces/filters/age-range.interface";

export class AgeRangeFilterStrategy implements IFilterStrategy {
    
    constructor(private emailFiltersRepository: IEmailFiltersRepository) {}

    async save(campaignId: number, ids: number[]): Promise<AgeRange> {
        return this.emailFiltersRepository.saveEmailAgeRange(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.emailFiltersRepository.deleteEmailAgeRange(campaignId);
    }

    async buildWhereClause(id: number): Promise<WhereOptions> {
        const ageRange = [];
        
        const ageRangeDB = await this.emailFiltersRepository.getAgeRangeById(id);

        ageRange.push(ageRangeDB.min);
        ageRange.push(ageRangeDB.max);
        
        return { idade: { [Op.between]: [ageRange[0], ageRange[1]] } };
    }
}