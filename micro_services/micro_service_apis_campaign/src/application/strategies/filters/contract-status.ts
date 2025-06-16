import { Op, WhereOptions } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IFiltersRepository from "../../../domain/contracts/repositories/IFiltersRepository";
import ContractStatusEmailAssociation from "../../../domain/entities/interfaces/associations/contract-status-email.interface";

export class ContractStatusFilterStrategy implements IFilterStrategy {
    
    constructor(private filtersRepository: IFiltersRepository) {}

    async save(campaignId: number, ids: number[]): Promise<ContractStatusEmailAssociation[]> {
        return this.filtersRepository.saveCampaignContractStatus(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.filtersRepository.deleteCampaignContractStatus(campaignId);
    }

    async buildWhereClause(ids: number[]): Promise<WhereOptions> {
        const status = [];
        
        for (const id of ids) {
            const contractStatus = await this.filtersRepository.getContractStatusById(id);
            status.push(contractStatus.status);
        }
        
        return { status_do_beneficiario: { [Op.in]: status } };
    }
}