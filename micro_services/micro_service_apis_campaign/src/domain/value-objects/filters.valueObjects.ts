import { ActiveFiltersValues, ActiveFilterKey } from "../entities/interfaces/filters-to-save.interface";
import { BooleanFiltersFlags, FilterValues } from "../entities/interfaces/campaign-create.interface";
import BirthDTOPersistence from "../entities/interfaces/birth-dto-persistence.interface";

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
        return ['operator', 'plan', 'contractStatus', 'uf', 'ageRange', 'birth', 'validity', 'gender'].includes(key);
    };

    public async getFilterValues() {
        const activeFiltersKey: ActiveFilterKey[] = await this.getActiveFilters();

        const activeFiltersValues: ActiveFiltersValues = {};
               
        activeFiltersKey.forEach(async (filterActive) => {
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
                case 'birth':
                    const birthDTOPersistence: BirthDTOPersistence = await this.extrairComponentesDaData(this.filterValues.birth);

                    activeFiltersValues.birth = birthDTOPersistence;
                    break;
                case 'validity':
                    activeFiltersValues.validity = this.filterValues.validity;
                    break;
                case 'gender':
                    activeFiltersValues.gender = this.filterValues.gender;
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

    // Funções auxiliares (coloque-as em um utils ou diretamente na classe se preferir)
    private async extrairComponentesDaData(dataArray: (number | string | null)[]): Promise<BirthDTOPersistence> {
        let day: number | null = null;
        let month: string | null = null;
        let year: number | null = null;

        for (const item of dataArray) {
            if (typeof item === 'number') {
                if (String(item).length === 4) {
                    year = item;
                } else if (String(item).length <= 2) {
                    day = item;
                }
            } else if (typeof item === 'string') {
                month = item;
            }
        }
        return { day, month, year };
    }
}