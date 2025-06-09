import { WhereOptions } from "sequelize";
import { EmailCampaignAttributes } from "../../../infrastructure/database/models/email-campaign.model";
import EmailCampaignEntity from "../../entities/EmailCampaign";
import EmailCampaign from "../../entities/interfaces/email-campaign/email-campaign.interface";
import FullEmailCampaign, { ShortFullEmailCampaign } from "../../entities/interfaces/email-campaign/full-email-campaign.interface";
import RecipientGroup, { RecipientGroupToSend } from "../../entities/interfaces/email-campaign/recipient-group.interface";
import { EmailCampaignStatus } from "../../types/email-status.types";

export default interface IEmailCampaignRepository {
    save(data: EmailCampaign): Promise<EmailCampaign>;

    findAll(): Promise<EmailCampaign[]>;
    
    findById(id: number): Promise<ShortFullEmailCampaign>;
    
    updateEmailTemplateId(emailTemplateId: number, campaign: EmailCampaignEntity): Promise<string>;

    update(payload: EmailCampaign): Promise<string>;

    getRecipientsByFilters(filters: WhereOptions): Promise<Partial<RecipientGroup>[] | string>;
    saveRecipientsGroup(recipientsGroup: Partial<RecipientGroup>[], emailCampaignId: number): Promise<RecipientGroup[]>;
    deleteRecipientsGroup(emailCampaignId: number): Promise<string>;
    getRecipientGroupById(emailCampaignId: number): Promise<RecipientGroupToSend>;
    // updateStatus(id: number, status: EmailCampaignStatus): Promise<[number]>;

    // delete(id: number): Promise<string>;
}