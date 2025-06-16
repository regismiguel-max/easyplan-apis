// import { WhereOptions } from "sequelize";
import CampaignEntity from "../../entities/Campaign";
import Campaign from "../../entities/interfaces/campaign.interface";
import ShortFullEmailCampaign from "../../entities/interfaces/email-campaign/full-email-campaign.interface";
// import RecipientGroup, { RecipientGroupToSend } from "../../entities/interfaces/recipient-group.interface";

export default interface ICampaignRepository {
    save(emailData: Campaign): Promise<Campaign>;

    findAll(typeCampaign: string): Promise<Campaign[]>;
    
    findById(id: number): Promise<ShortFullEmailCampaign>;
    
    updateEmailTemplateId(emailTemplateId: number, emailCampaign: CampaignEntity): Promise<string>;

    update(payload: Campaign): Promise<string>;

    // getRecipientsByFilters(filters: WhereOptions): Promise<Partial<RecipientGroup>[] | string>;
    // saveRecipientsGroup(recipientsGroup: Partial<RecipientGroup>[], emailCampaignId: number): Promise<RecipientGroup[]>;
    // deleteRecipientsGroup(emailCampaignId: number): Promise<string>;
    // getRecipientGroupById(emailCampaignId: number): Promise<RecipientGroupToSend>;
    // updateStatus(id: number, status: CampaignStatus): Promise<[number]>;

    // delete(id: number): Promise<string>;
}