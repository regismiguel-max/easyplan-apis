import { ActiveFiltersValues, ActiveFilterKey } from "../entities/interfaces/filters-to-save.interface";
import { BooleanFiltersFlags, FilterValues } from "../entities/interfaces/campaign-create.interface";

export default class FiltersVO {
    public filterValues: FilterValues;
    public booleanFiltersFlags: BooleanFiltersFlags;


    constructor(filtersValues: FilterValues, booleanFiltersFlags: BooleanFiltersFlags) {
        this.filterValues= filtersValues;
        this.booleanFiltersFlags = booleanFiltersFlags;
    }

    public async getActiveFilters(): Promise<ActiveFilterKey[]> {
        const activeFiltersArray: ActiveFilterKey[] = Object.entries(this.booleanFiltersFlags).filter(([key, value]) => {
            return key.startsWith('filterBy') && value === true; 
        }).map(([key]) => {
            const resultReplace = key.replace('filterBy', '');

            const finalResult = resultReplace.charAt(0).toLowerCase() + resultReplace.slice(1);

            return finalResult;
        }).filter(this.isActiveFilterKey);

        return activeFiltersArray;
    }
    public isActiveFilterKey(key: string): key is ActiveFilterKey {
        return ['operator', 'plan', 'contractStatus', 'uf', 'ageRange', 'validity'].includes(key);
    };

    public async getFilterValues() {
        const activeFiltersKey: ActiveFilterKey[] = await this.getActiveFilters();

        const activeFiltersValues: ActiveFiltersValues = {};
               
        activeFiltersKey.forEach((filterActive) => {
            switch (filterActive) {
                case 'operator':
                    activeFiltersValues.operator = this.filterValues.operator;
                    break;
                case 'plan':
                    activeFiltersValues.plan = this.filterValues.plan;
                    break;
                case 'contractStatus':
                    activeFiltersValues.contractStatus = this.filterValues.contractStatus;
                    break;
                case 'uf':
                    activeFiltersValues.uf = this.filterValues.uf;
                    break;
                case 'ageRange':
                    const [min, max] = this.filterValues.ageRange;

                    if(min === null || max === null){ throw new Error('Filtro ageRange está ativo, mas os valores não foram preenchidos.'); }
                    
                    activeFiltersValues.ageRange = [min, max];
                    break;
                case 'validity':
                    activeFiltersValues.validity = this.filterValues.validity;
                    break;
                // case 'modality':
                //     activeFilterValues.modality = this.props.modality;
                //     break;
                default:
                    break;
            }
        }); 

        return {
            activeFiltersKey,
            activeFiltersValues
        };
    }
    
    
    public async hasAnyFilter(): Promise<boolean> {
        return Object.entries(this.booleanFiltersFlags).some(([key, value]) => {
            return key.startsWith('filterBy') && value === true;
        });
    }
}