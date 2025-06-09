import { Op } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IEmailFiltersRepository from "../../repositories-interfaces/email-filters.repository";

export class ModalityFilterStrategy implements IFilterStrategy {
    
    constructor(private emailFiltersRepository: IEmailFiltersRepository) {}

    async save(campaignId: number, ids: number[]): Promise<any> {
        return this.emailFiltersRepository.saveEmailModality(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.emailFiltersRepository.deleteEmailModality(campaignId);
    }

    async buildWhereClause(ids: number[]): Promise<any> {
        const modalityDescricao = [];
        
        for (const id of ids) {
            const modality = await this.emailFiltersRepository.getModalityById(id);
            modalityDescricao.push(modality.descricao_modalidade);
        }
        
        return { modalityDescricao: { [Op.in]: modalityDescricao } };
    }
}