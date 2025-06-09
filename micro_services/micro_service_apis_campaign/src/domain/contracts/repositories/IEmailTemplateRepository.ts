import EmailTemplateEntity from "../../entities/EmailTemplate";
import EmailCampaign from "../../entities/interfaces/email-campaign/email-campaign.interface";
import EmailTemplate from "../../entities/interfaces/email-campaign/email-template.interface";

export default interface IEmailTemplateRepository {
    save(campaign: EmailTemplateEntity): Promise<EmailTemplate>;
    
    findById(id: number): Promise<EmailTemplate>;
    
    // findAll(): Promise<EmailCampaign[] | string>;
    
    update(newCampaign: EmailTemplateEntity): Promise<string>;
    
    // updateStatus(id: string, status: string): Promise<EmailCampaign>;
    
    // delete(campaign: EmailCampaign): Promise<EmailCampaign>;
}