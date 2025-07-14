import { literal, WhereOptions } from "sequelize";
import IFiltersRepository from "../../../domain/contracts/repositories/IFiltersRepository";
import IFilterStrategy from "../../../domain/contracts/strategies/IFilterStrategy";
import Validity from "../../../domain/entities/interfaces/filters/validity.interface";
import { Op } from "sequelize";
import Birth from "../../../domain/entities/interfaces/filters/birth.interface";
import BirthDTOPersistence from "../../../domain/entities/interfaces/birth-dto-persistence.interface";

export class BirthFilterStrategy implements IFilterStrategy {
    
    constructor(private filtersRepository: IFiltersRepository) {}

    async save(campaignId: number, birthData: BirthDTOPersistence): Promise<Birth> {
        return this.filtersRepository.saveCampaignBirth(campaignId, birthData);
    }

    async delete(campaignId: number) {
        return this.filtersRepository.deleteCampaignBirth(campaignId);
    }

    async buildWhereClause(id: number): Promise<WhereOptions> {
        // const birthDataArray = [];
        const birthData: Birth = await this.filtersRepository.getBirthById(id);
        const {day, month, year} = birthData;

        const conditions: WhereOptions[] = [];

        const mesesMap: { [key: string]: string } = {
            'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
            'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
            'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
        };
        
        const diaStr = day ? String(day).padStart(2, '0') : null;
        const mesStr = month ? mesesMap[month.toLowerCase()] : null;
        const anoStr = year ? String(year) : null;

        if (diaStr && mesStr && anoStr) {
        // Exatamente dia/mês/ano
        conditions.push(literal(`data_de_nascimento = '${anoStr}/${mesStr}/${diaStr}'`));
        } else {
            // Parcial: podemos usar SUBSTRING para comparar partes da string
            if (diaStr) {
                conditions.push(literal(`SUBSTRING(data_de_nascimento, 9, 2) = '${diaStr}'`));
            }
            if (mesStr) {
                conditions.push(literal(`SUBSTRING(data_de_nascimento, 6, 2) = '${mesStr}'`));
            }
            if (anoStr) {
                conditions.push(literal(`SUBSTRING(data_de_nascimento, 1, 4) = '${anoStr}'`));
            }
        }

        // Se nenhuma condição de data for encontrada, retorna um objeto vazio para o where
        if (conditions.length === 0) {
            return {};
        }

        // Combina todas as condições com AND
        return {
            [Op.and]: conditions
        };
    }

    async pureBuildWhereClause(birthFilterValues: BirthDTOPersistence): Promise<WhereOptions> {
        const conditions: WhereOptions[] = [];

        const mesesMap: { [key: string]: string } = {
            'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
            'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
            'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
        };
        
        // const diaStr = day ? String(day).padStart(2, '0') : null;
        // const mesStr = month ? mesesMap[month.toLowerCase()] : null;
        // const anoStr = year ? String(year) : null;
        const diaStr: string | undefined =  birthFilterValues.day?.toString(); 
        const mesStr: string | null = birthFilterValues.month ? mesesMap[birthFilterValues.month.toLowerCase()] : null;
        const anoStr: string | undefined = birthFilterValues.year?.toString();

        if (diaStr && mesStr && anoStr) {
        // Exatamente dia/mês/ano
        conditions.push(literal(`data_de_nascimento = '${anoStr}/${mesStr}/${diaStr}'`));
        } else {
            // Parcial: podemos usar SUBSTRING para comparar partes da string
            if (diaStr) {
                conditions.push(literal(`SUBSTRING(data_de_nascimento, 9, 2) = '${diaStr}'`));
            }
            if (mesStr) {
                conditions.push(literal(`SUBSTRING(data_de_nascimento, 6, 2) = '${mesStr}'`));
            }
            if (anoStr) {
                conditions.push(literal(`SUBSTRING(data_de_nascimento, 1, 4) = '${anoStr}'`));
            }
        }

        // Se nenhuma condição de data for encontrada, retorna um objeto vazio para o where
        if (conditions.length === 0) {
            return {};
        }

        console.log("vamos entender Birth", conditions);
        
        // Combina todas as condições com AND
        return {
            [Op.and]: conditions
        };
    }

    getLabel(): string {
        return 'Data de Aniversário';
    }
}
