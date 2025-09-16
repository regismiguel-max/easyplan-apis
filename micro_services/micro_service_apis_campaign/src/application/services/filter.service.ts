import { Op, WhereOptions } from "sequelize";
import IFilterService from "../../domain/contracts/service/IFilterService";
import FilterStrategyFactory from "../strategies/filter-strategy.factory";
import { ActiveFilterKey, ActiveFiltersValues } from "../../domain/entities/interfaces/filters-to-save.interface";
import FiltersProcessed, { FilterProcessBuildVerificationResponse, FilterProcessResponse, FilterStep } from "../../domain/entities/interfaces/email-campaign/output/process-filter.interface";
import BirthDTOPersistence from "../../domain/entities/interfaces/birth-dto-persistence.interface";
import { BlobOptions } from "buffer";
// import IFilterService from "../../domain/contracts/services/IFilterService";
// import { WhereClause } from "../../domain/valueObjects/WhereClause";
// import { FilterStrategyFactory } from "../strategies/FilterStrategyFactory";

export class FilterService implements IFilterService {

    constructor(
        private filterStrategyFactory: FilterStrategyFactory
    ) {}

    async processToBuildVerificationIfHasBeneficiary(activeFilters: ActiveFilterKey[], activeFiltersValues: ActiveFiltersValues): Promise<FilterProcessBuildVerificationResponse>{
        let whereClauses: any[] = [];
        const filterSteps: FilterStep[] = [];

        activeFilters = activeFilters.filter(key => key !== 'gender');
        
        for (const filterType of activeFilters) {
            const ids = activeFiltersValues[filterType];

            const strategy = this.filterStrategyFactory.createFilterStrategy(filterType);

            if (ids) {
                if(Array.isArray(ids) && ids.length > 0) {
                    if (filterType === 'validity' || filterType === 'ageRange') {
                        console.log('AgeRange entrou e vai construir a clausula');
                        
                        const whereClause = await strategy.pureBuildWhereClause(ids);
                        console.log('Vamos entender Faixa Étaria: ', whereClause);
                        
                        whereClauses.push(whereClause);
                        
                        filterSteps.push({
                            key: filterType,
                            label: strategy.getLabel(),
                            where: whereClause
                        });
                    } else {
                        console.log('Operator entrou onde devia e vai começar a construir a clausula');
                        
                        const whereClause = await strategy.pureBuildWhereClause(ids);
                        console.log('Vamos entender Operadora final: ', whereClause);
                        
                        whereClauses.push(whereClause);
                        
                        filterSteps.push({
                            key: filterType,
                            label: strategy.getLabel(),
                            where: whereClause
                        });
                    }
                } else {
                    // Caso de uso para o BirthData
                    
                    const whereClause = await strategy.pureBuildWhereClause(ids as BirthDTOPersistence);

                    whereClauses.push(whereClause);

                    filterSteps.push({
                        key: filterType,
                        label: strategy.getLabel(),
                        where: whereClause
                    });
                }
            }
        }
        // Combinar todas as cláusulas where com AND
        const combinedWhereClause: WhereOptions = whereClauses.length > 0 ? { [Op.and]: [...whereClauses, { tipo_de_beneficiario: 'Titular' }] } : {};
        filterSteps.push({
            key: 'tipoBeneficiario',
            label: 'Tipo de Beneficiário',
            where: { tipo_de_beneficiario: 'Titular' }
        })

        console.log('Vamos vê a clausula final', combinedWhereClause);
        
        
        const response: FilterProcessBuildVerificationResponse = {
            whereClause: combinedWhereClause,
            filterSteps
        };

        return  response;

    }

    async processFiltersToSave(campaignId: number, activeFilters: ActiveFilterKey[], activeFiltersValues: ActiveFiltersValues): Promise<FilterProcessResponse> {
        // Dados que o service deve retornar;
        // FiltersResults trata-se dos resultados da persistência dos filtros;
        // WhereClauses trata-se da clasula Where da query que será utilizada para gerar o grupo destinatário;
        let filterResults: FiltersProcessed = {};
        let whereClauses: any[] = [];
        const filterSteps: FilterStep[] = [];

        // Exclução dos valores do filtro de gênero pois o mesmo ta sendo salvo direto na campanha sem precisar de tabela associativa;
        activeFilters = activeFilters.filter(key => key !== 'gender');
        
        // Loop para iterar sobre cada filtro que foi utilizado na criação da campanha e contém valor a ser persistido e somado a clausula Where;
        for (const filterType of activeFilters) {
            // activeFilters nada mais é do que os filtros que foram escolhidos para a respectiva campanha;
            // activeFiltersValues nada mais é do que os valores dos filtros escolhidos para a respectiva campanha;
            // filterType nada mais é do que o filtro ativo atual do loop;

            // ids trata-se do valor do filtro ativo atual do loop. Se o filtro ativo atual é Operadora, ids será os ids das operadoras que foram escolhidas para a campanha em questão;
            const ids = activeFiltersValues[filterType];

            // Uso do Padrão de Projeto Factory para criar o Padrão de Projeto Strategy do filtro ativo atual no loop;
            const strategy = this.filterStrategyFactory.createFilterStrategy(filterType);
            
            // Validação básica para confirma que contém valor no filtro ativo em questão;
            if (ids) {
                if(Array.isArray(ids) && ids.length > 0) {
                    // Com o strategy do filtro ativo em mãos começaremos o 1° passo: Salvar os valores do filtro ativo atual no loop;
                    // Passo o id da campanha e os valores do filtro para ser persistido;
                    // O resultado da persistência do filtro ativo atual no loop é armazenado no seu respectivo campo no dado a ser retornado;
                    filterResults[filterType] = await strategy.save(campaignId, ids);
                    
                    // Inicio do 2° Passo: Construir a clausula Where do filtro ativo atual no loop
                    // Caso o filtro ativo seja Vigência ou Faixa Etária
                    if (filterType === 'validity' || filterType === 'ageRange') {
                        const id = filterResults[filterType]?.id;
                        
                        const whereClause = await strategy.buildWhereClause(id);
    
                        whereClauses.push(whereClause);

                        filterSteps.push({
                            key: filterType,
                            label: strategy.getLabel(),
                            where: whereClause
                        });
                    } else {
                        const whereClause = await strategy.buildWhereClause(ids);
                        
                        whereClauses.push(whereClause);

                        filterSteps.push({
                            key: filterType,
                            label: strategy.getLabel(),
                            where: whereClause
                        });
                    }
                } else {
                    // Caso de uso para o BirthData
                    filterResults[filterType] = await strategy.save(campaignId, ids);
                    
                    if(filterType !== 'birth') {throw new Error('Nesse fluxo só esperamos BirthData mas veio outra coisa.')}

                    const id = filterResults[filterType]?.id;
                    
                    const whereClause = await strategy.buildWhereClause(id);

                    whereClauses.push(whereClause);

                    filterSteps.push({
                        key: filterType,
                        label: strategy.getLabel(),
                        where: whereClause
                    });
                }
            }
        }
        // Combinar todas as cláusulas where com AND
        const combinedWhereClause: WhereOptions = whereClauses.length > 0 ? { [Op.and]: whereClauses } : {};

        console.log('Retorno final do process service filters to save: ', filterResults, combinedWhereClause);
        
        const response: FilterProcessResponse = {
            filterResults,
            whereClause: combinedWhereClause,
            filterSteps
        };

        return  response;
    }

    async processFiltersToEdit(campaignId: number, activeFilters: ActiveFilterKey[], activeFiltersValues: ActiveFiltersValues, diffs: {key: string, value: boolean}[]): Promise<FilterProcessResponse> {
        let filterResults: FiltersProcessed = {};
        let whereClauses: any[] = [];
        const filterSteps: FilterStep[] = [];

        if(diffs.length > 0) {
            console.log('Chegou a diferença: ', diffs);
            for(let diff of diffs){
                let key = diff.key.split('y')[1];
                key = key.charAt(0).toLowerCase() + key.slice(1);
                console.log('Vamos vê se pegou certin: ', key);
                

                const strategy = this.filterStrategyFactory.createFilterStrategy(key);

                strategy.delete(campaignId);

                console.log('Deletado com sucesso - XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
            }
            
        }

        activeFilters = activeFilters.filter(key => key !== 'gender');
        
        for (const filterType of activeFilters) {
            const ids = activeFiltersValues[filterType];

            const strategy = this.filterStrategyFactory.createFilterStrategy(filterType);

            if (ids) {
                if(Array.isArray(ids) && ids.length > 0) {
                    const deleteFilter = await strategy.delete(campaignId);
                    if (!deleteFilter) throw new Error('Erro de deletação ou retorno do repository');
                    
                    filterResults[filterType] = await strategy.save(campaignId, ids);

                    if (filterType === 'validity' || filterType === 'ageRange') {
                        const id = filterResults[filterType]?.id;
                        
                        const whereClause = await strategy.buildWhereClause(id);
                        
                        whereClauses.push(whereClause);
                        filterSteps.push({
                            key: filterType,
                            label: strategy.getLabel(),
                            where: whereClause
                        });
                    } else {
                        const whereClause = await strategy.buildWhereClause(ids);
                        
                        whereClauses.push(whereClause);
                        filterSteps.push({
                            key: filterType,
                            label: strategy.getLabel(),
                            where: whereClause
                        });
                    }
                } else {
                    const deleteFilter = await strategy.delete(campaignId);
                    if (!deleteFilter) throw new Error('Erro de deletação ou retorno do repository');

                    filterResults[filterType] = await strategy.save(campaignId, ids);
                    
                    if(filterType !== 'birth') {throw new Error('Nesse fluxo só esperamos BirthData mas veio outra coisa.')}

                    const id = filterResults[filterType]?.id;
                    
                    const whereClause = await strategy.buildWhereClause(id);

                    whereClauses.push(whereClause);
                    filterSteps.push({
                        key: filterType,
                        label: strategy.getLabel(),
                        where: whereClause
                    });
                }
            }
        }
        // Combinar todas as cláusulas where com AND
        const combinedWhereClause: WhereOptions = whereClauses.length > 0 ? { [Op.and]: whereClauses } : {};

        console.log('Retorno final do process service filters to save: ', filterResults, combinedWhereClause);
        
        const response: FilterProcessResponse = {
            filterResults,
            whereClause: combinedWhereClause,
            filterSteps
        };

        return  response;
    }
}