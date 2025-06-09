import IFilterStrategy from "../../domain/contracts/strategies/IFilterStrategy";
import IEmailFiltersRepository from "../repositories-interfaces/email-filters.repository";
import { AgeRangeFilterStrategy } from "./filters/age-range";
import { ContractStatusFilterStrategy } from "./filters/contract-status";
import { ModalityFilterStrategy } from "./filters/modality";
import { OperatorFilterStrategy } from "./filters/operator";
import { PlanFilterStrategy } from "./filters/plan";
import { UfFilterStrategy } from "./filters/uf";
import { ValidityFilterStrategy } from "./filters/validity";

export default class FilterStrategyFactory {
  constructor(private emailFiltersRepository: IEmailFiltersRepository) {}

  createFilterStrategy(filterType: string): IFilterStrategy {
    console.log('Strategy Factory - Entrou na fábrica pra criar o strategy de: ', filterType);
    
    switch (filterType) {
      case 'operator':
        return new OperatorFilterStrategy(this.emailFiltersRepository);
      case 'plan':
        return new PlanFilterStrategy(this.emailFiltersRepository);
      case 'contractStatus':
        return new ContractStatusFilterStrategy(this.emailFiltersRepository);
      // case 'modality':
      //   return new ModalityFilterStrategy(this.emailFiltersRepository);
      case 'uf':
        return new UfFilterStrategy(this.emailFiltersRepository);
      case 'ageRange':
        return new AgeRangeFilterStrategy(this.emailFiltersRepository);
      case 'validity':
        return new ValidityFilterStrategy(this.emailFiltersRepository);
      // Outros casos...
      default:
        throw new Error(`Filtro não suportado: ${filterType}`);
    }
  }
}
