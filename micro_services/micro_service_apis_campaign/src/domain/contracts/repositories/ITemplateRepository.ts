import TemplateEntity from "../../entities/Template";
import Template from "../../entities/interfaces/template.interface";

export default interface ITemplateRepository {
    save(campaign: TemplateEntity): Promise<Template>;
    
    findById(id: number): Promise<Template>;
    
    // findAll(): Promise<EmailCampaign[] | string>;
    
    update(newCampaign: TemplateEntity): Promise<string>;
    
    // updateStatus(id: string, status: string): Promise<EmailCampaign>;
    
    // delete(campaign: EmailCampaign): Promise<EmailCampaign>;
}