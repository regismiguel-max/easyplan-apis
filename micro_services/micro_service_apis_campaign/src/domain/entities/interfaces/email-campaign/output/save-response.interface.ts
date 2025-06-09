import { WhereOptions } from "sequelize";
import EmailCampaign from "../email-campaign.interface";
import RecipientGroup from "../recipient-group.interface";
import AgeRange from "../../filters/age-range.interface";
import ContractStatus from "../../filters/contract-status.interface";
import Operator from "../../filters/operator.interface";
import Plan from "../../filters/plan.interface";
import Uf from "../../filters/uf.interface";
import Validity from "../../filters/validity.interface";

export default interface SaveResponse {
    emailCampaign: EmailCampaign;
    ageRange?: AgeRange | null;
    contractStatus?: ContractStatus | null;
    operator?: Operator | null;
    plan?: Plan | null;
    uf?: Uf | null;
    validity?: Validity | null;
    whereClause?: WhereOptions | null;
    recipientGroup?: Partial<RecipientGroup>[] | null;
    notRecipientGroup?: string | null;
    recipientGroupSaved?: RecipientGroup[] | null;
}
