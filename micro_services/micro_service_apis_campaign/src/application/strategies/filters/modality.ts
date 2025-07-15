import { Op, WhereOptions } from "sequelize";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import IFiltersRepository from "../../../domain/contracts/repositories/IFiltersRepository";

export class ModalityFilterStrategy implements IFilterStrategy {
    
    constructor(private filtersRepository: IFiltersRepository) {}

    async save(campaignId: number, ids: number[]): Promise<any> {
        return this.filtersRepository.saveCampaignModality(campaignId, ids);
    }

    async delete(campaignId: number) {
        return this.filtersRepository.deleteCampaignModality(campaignId);
    }

    async buildWhereClause(ids: number[]): Promise<any> {
        const modalityDescricao = [];
        
        for (const id of ids) {
            const modality = await this.filtersRepository.getModalityById(id);
            modalityDescricao.push(modality.descricao_modalidade);
        }
        
        return { modalityDescricao: { [Op.in]: modalityDescricao } };
    }

    getLabel(): string {
        return 'Modalidade';
    }

    async pureBuildWhereClause(ids: number[]): Promise<WhereOptions> {
        const codigoProdutos = [];
        
        for (const id of ids) {
            const operator = await this.filtersRepository.getOperatorById(id);
            codigoProdutos.push(operator.nome_operadora);
        }

        console.log('Vamos entender operadora: ', codigoProdutos);
        
        return { operadora: { [Op.in]: codigoProdutos } };
    }
}