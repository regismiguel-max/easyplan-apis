import IFilterStrategy from "../../domain/contracts/strategies/IFilterStrategy";
import IFiltersRepository from "../../domain/contracts/repositories/IFiltersRepository";
import { AgeRangeFilterStrategy } from "./filters/age-range";
import { ContractStatusFilterStrategy } from "./filters/contract-status";
import { ModalityFilterStrategy } from "./filters/modality";
import { OperatorFilterStrategy } from "./filters/operator";
import { PlanFilterStrategy } from "./filters/plan";
import { UfFilterStrategy } from "./filters/uf";
import { ValidityFilterStrategy } from "./filters/validity";
import { BirthFilterStrategy } from "./filters/birth";

export default class FilterStrategyFactory {
  constructor(private filtersRepository: IFiltersRepository) {}

  createFilterStrategy(filterType: string): IFilterStrategy {
    console.log('Strategy Factory - Entrou na fábrica pra criar o strategy de: ', filterType);
    
    switch (filterType) {
      case 'operator':
        return new OperatorFilterStrategy(this.filtersRepository);
      case 'plan':
        return new PlanFilterStrategy(this.filtersRepository);
      case 'contractStatus':
        return new ContractStatusFilterStrategy(this.filtersRepository);
      // case 'modality':
      //   return new ModalityFilterStrategy(this.filtersRepository);
      case 'uf':
        return new UfFilterStrategy(this.filtersRepository);
      case 'ageRange':
        return new AgeRangeFilterStrategy(this.filtersRepository);
      case 'validity':
        return new ValidityFilterStrategy(this.filtersRepository);
      case 'birth':
        return new BirthFilterStrategy(this.filtersRepository);
      // Outros casos...
      default:
        throw new Error(`Filtro não suportado: ${filterType}`);
    }
  }
}
