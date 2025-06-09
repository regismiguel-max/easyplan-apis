// import EmailCampaignModel, { EmailCampaignAttributes } from "./models/email-campaign.model";
// import IEmailCampaignRepository from "../../domain/contracts/repositories/IEmailCampaignRepository";
// import EmailCampaignEntity from "../../domain/entities/EmailCampaign";
// import EmailTemplateModel from "../database/models/email-template.model";
import StatisticsEmailCampaignModel from "../database/models/statistics-email-campaign.model";

class StatisticsEmailCampaignRepository {
    async create(recipientGroup: number, campaignId: number): Promise<void>{
        const statistics = await StatisticsEmailCampaignModel.create({
            emailCampaignId: campaignId,
            countsRecipients: recipientGroup
        })
        console.log(statistics);

        return;
    }

    // async updateProcessed(eventType: string): Promise<string> {
    //     console.log('Entramos na repository');
        
    //     if (!eventType) throw new Error(`Erro! Não veio event type: ${eventType}`);

    //     console.log('Passou na validação e vamos realizar a query');
        
    //     const [affectedCount] = await StatisticsEmailCampaignModel.update(
    //         {processesd: },
    //         {where: {id: payload.id}}
    //     )
    //     console.log('(Volta)Query realizada: ');
    //     console.log(affectedCount);
        
    //     return affectedCount > 0
    //         ? 'Campanha de email atualizada com sucesso.'
    //         : 'Nenhuma campanha de email atualizada. Falhou'
    // }

    // async findById(id: number): Promise<EmailCampaignEntity> {
    //     console.log("Entramos para procurar campanha pelo id");
    //     // {
    //     //     include: [
    //     //         {
    //     //             model: EmailTemplateModel,
    //     //         }
    //     //     ]
    //     // }
    //     const emailCampaign = await EmailCampaignModel.findByPk(id);
    //     if (!emailCampaign) {
    //         throw new Error("Error");
    //     }
    //     const pureObject = emailCampaign.get({plain: true});
    //     return this.toEntity(pureObject);
    // }

    // async findAll(): Promise<EmailCampaignEntity[]> {
    //     const emailCampaignsResult = await EmailCampaignModel.findAll({order: [['createdAt', 'DESC']]});

    //     let response: EmailCampaignEntity[] = [];
    //     await emailCampaignsResult.forEach(ec => {
    //         const pureObject = ec.get({plain: true});
    //         let resulttt = this.toEntity(pureObject);
    //         response.push(resulttt);
    //     })
    //     return response;
    // }

    // async updateEmailTemplateId(templateId: number, campaign: EmailCampaignEntity): Promise<string> {
    //     console.log('Entramos para atualizar a campanha');
    //     console.log(campaign.emailTemplateId);
    //     console.log(campaign.id);
        
    //     if (!templateId || !campaign.id) {
    //         throw new Error("error");
    //     }
    //     const [affectedCount] = await EmailCampaignModel.update(
    //         {emailTemplateId: templateId},
    //         { where: { id: campaign.id }}, // Assumindo que EmailCampaign tem um campo 'id'
    //     );
    //     return affectedCount > 0
    //         ? 'Campanha de email e template salvos e atribuidos com sucesso.'
    //         : 'Falhou. Nenhuma campanha de email atualizada.'
    // }
    
    // async updateStatus(id: string, status: EmailCampaignStatus): Promise<[number]> {
    //     return EmailCampaignModel.update(
    //         { status: status }, 
    //         { where: { id: id } }
    //     );
    // }

    // async delete(id: number): Promise<string> {
    //     console.log('Entramos no repository: ', id);
        
    //     const result = await EmailCampaignModel.destroy({
    //         where: { id: id },
    //     });

    //     return result > 0 ? 'Deletado com sucesso' : 'Falha na deleção';
    // }

    // async findByStatus(status: string): Promise<EmailCampaign[]> {
    //     return EmailCampaignModel.findAll({
    //         where: {
    //             status: status
    //         }
    //     });
    // }

    // async findByDateRange(startDate: Date, endDate: Date): Promise<EmailCampaign[]> {
    //     return EmailCampaignModel.findAll({
    //         where: {
    //             createdAt: {
    //                 [Op.between]: [startDate, endDate]
    //             }
    //         }
    //     });
    // }

//     private toEntity(model: EmailCampaignAttributes): EmailCampaignEntity{
//         console.log("Entrou para converter Model para Entidade", model);
        
//         return new EmailCampaignEntity(
//             model,
//             model.emailTemplateId ? model.emailTemplateId : undefined,
//         );
//     }
}

export default StatisticsEmailCampaignRepository;