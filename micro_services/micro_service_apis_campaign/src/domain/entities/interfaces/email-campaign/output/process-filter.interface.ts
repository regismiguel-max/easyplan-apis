import { WhereOptions } from "sequelize";
import AgeRange from "../../filters/age-range.interface";
import ContractStatus from "../../filters/contract-status.interface";
import Operator from "../../filters/operator.interface";
import Plan from "../../filters/plan.interface";
import Uf from "../../filters/uf.interface";
import Validity from "../../filters/validity.interface";
import Birth from "../../filters/birth.interface";
import OperatorEmailAssociation from "../../associations/operator-email.interface";
import PlanEmailAssociation from "../../associations/plan-email.interface";
import ContractStatusEmailAssociation from "../../associations/contract-status-email.interface";
import UfEmailAssociation from "../../associations/uf-email.interface";

export default interface FiltersProcessed {
    ageRange?: AgeRange | null;
    validity?: Validity | null;
    contractStatus?: ContractStatusEmailAssociation[] | null;
    operator?: OperatorEmailAssociation[] | null;
    plan?: PlanEmailAssociation[] | null;
    uf?: UfEmailAssociation[] | null;
    birth?: Birth | null;
    gender?: string;
}

export interface FilterProcessResponse {
    filterResults: FiltersProcessed;
    whereClause: WhereOptions;
}