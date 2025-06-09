import { Op, WhereOptions } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IEmailFiltersRepository from "../../repositories-interfaces/email-filters.repository";
import Validity from "../../../domain/entities/interfaces/filters/validity.interface";

export class ValidityFilterStrategy implements IFilterStrategy {
    
    constructor(private emailFiltersRepository: IEmailFiltersRepository) {}

    async save(campaignId: number, ids: string[]): Promise<Validity> {
        return this.emailFiltersRepository.saveEmailValidity(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.emailFiltersRepository.deleteEmailValidity(campaignId);
    }

    async buildWhereClause(id: number): Promise<WhereOptions> {
        const validityRange = [];
        
        const validity = await this.emailFiltersRepository.getValidityById(id);

        const start = validity.start.toISOString().split('T')[0];
        const end = validity.end.toISOString().split('T')[0];

        validityRange.push(start);
        validityRange.push(end);
        
        return { vigencia: { [Op.between]: validityRange } };
    }
}