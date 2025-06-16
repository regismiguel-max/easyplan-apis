import { Op, WhereOptions } from "sequelize";
import IFilterService from "../../domain/contracts/service/IFilterService";
import FilterStrategyFactory from "../strategies/filter-strategy.factory";
import { ActiveFilterKey, ActiveFiltersValues } from "../../domain/entities/interfaces/filters-to-save.interface";
import FiltersProcessed, { FilterProcessResponse } from "../../domain/entities/interfaces/email-campaign/output/process-filter.interface";
// import IFilterService from "../../domain/contracts/services/IFilterService";
// import { WhereClause } from "../../domain/valueObjects/WhereClause";
// import { FilterStrategyFactory } from "../strategies/FilterStrategyFactory";

export class FilterService implements IFilterService {

    constructor(
        private filterStrategyFactory: FilterStrategyFactory
    ) {}

    async processFiltersToSave(campaignId: number, activeFilters: ActiveFilterKey[], activeFiltersValues: ActiveFiltersValues): Promise<FilterProcessResponse> {
        let filterResults: FiltersProcessed = {};
        let whereClauses: any[] = [];
        
        for (const filterType of activeFilters) {
            const ids = activeFiltersValues[filterType];
            
            if (ids && ids.length > 0) {
                const strategy = this.filterStrategyFactory.createFilterStrategy(filterType);
                
                // Salvar os filtros
                filterResults[filterType] = await strategy.save(campaignId, ids);
                
                // Construir cláusula where
                if (filterType === 'validity' || filterType === 'ageRange') {
                    const id = filterResults[filterType]?.id;
                    
                    const whereClause = await strategy.buildWhereClause(id);

                    whereClauses.push(whereClause); 
                } else {
                    const whereClause = await strategy.buildWhereClause(ids);

                    whereClauses.push(whereClause);
                }
            }
        }
        // Combinar todas as cláusulas where com AND
        const combinedWhereClause: WhereOptions = whereClauses.length > 0 ? { [Op.and]: whereClauses } : {};

        console.log('Retorno final do process service filters to save: ', filterResults, combinedWhereClause);
        
        const response: FilterProcessResponse = {
            filterResults,
            whereClause: combinedWhereClause
        };

        return  response;
    }
            
            
    async processFiltersToEdit(campaignId: number, activeFiltersKey: ActiveFilterKey[], activeFiltersValues: ActiveFiltersValues): Promise<FilterProcessResponse> {
        const filterResults: FiltersProcessed = {};
        let whereClauses: any[] = [];
            
        for(const activeFilter of activeFiltersKey) {
            const ids = activeFiltersValues[activeFilter];

            if(ids && ids.length > 0) {
                const strategy = await this.filterStrategyFactory.createFilterStrategy(activeFilter);

                const deleteFilter = await strategy.delete(campaignId);

                if (!deleteFilter) throw new Error('Erro de deletação ou retorno do repository');

                filterResults[activeFilter] = await strategy.save(campaignId, ids);

                // Construir cláusula where
                if (activeFilter === 'validity' || activeFilter === 'ageRange') {
                    const id = filterResults[activeFilter]?.id;
                    
                    const whereClause = await strategy.buildWhereClause(id);

                    whereClauses.push(whereClause); 
                } else {
                    const whereClause = await strategy.buildWhereClause(ids);

                    whereClauses.push(whereClause);
                }
            }
        }

        // Combinar todas as cláusulas where com AND
        const combinedWhereClause: WhereOptions = whereClauses.length > 0 ? { [Op.and]: whereClauses } : {};

        console.log('Retorno final do process service filters to save: ', filterResults, combinedWhereClause);
        
        const response: FilterProcessResponse = {
            filterResults,
            whereClause: combinedWhereClause
        };

        console.log('Veja o retorno final de process filter edit: ', filterResults);

        return response;
    }
}