import { WhereOptions } from "sequelize";
import AgeRange from "../../filters/age-range.interface";
import ContractStatus from "../../filters/contract-status.interface";
import Operator from "../../filters/operator.interface";
import Plan from "../../filters/plan.interface";
import Uf from "../../filters/uf.interface";
import Validity from "../../filters/validity.interface";

export default interface FiltersProcessed {
    ageRange?: AgeRange | null;
    validity?: Validity | null;
    contractStatus?: ContractStatus[] | null;
    operator?: Operator[] | null;
    plan?: Plan[] | null;
    uf?: Uf[] | null;
}

export interface FilterProcessResponse {
    filterResults: FiltersProcessed;
    whereClause: WhereOptions;
}