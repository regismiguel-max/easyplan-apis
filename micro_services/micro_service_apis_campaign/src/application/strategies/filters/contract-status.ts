import { Op, WhereOptions } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IEmailFiltersRepository from "../../repositories-interfaces/email-filters.repository";
import ContractStatusEmailAssociation from "../../../domain/entities/interfaces/associations/contract-status-email.interface";

export class ContractStatusFilterStrategy implements IFilterStrategy {
    
    constructor(private emailFiltersRepository: IEmailFiltersRepository) {}

    async save(campaignId: number, ids: number[]): Promise<ContractStatusEmailAssociation[]> {
        return this.emailFiltersRepository.saveEmailContractStatus(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.emailFiltersRepository.deleteEmailContractStatus(campaignId);
    }

    async buildWhereClause(ids: number[]): Promise<WhereOptions> {
        const status = [];
        
        for (const id of ids) {
            const contractStatus = await this.emailFiltersRepository.getContractStatusById(id);
            status.push(contractStatus.status);
        }
        
        return { status_do_beneficiario: { [Op.in]: status } };
    }
}