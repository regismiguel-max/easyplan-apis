import CampaignEntity from "../../domain/entities/Campaign";
import CampaignTemplateModel from "../database/models/template.model";
import { CampaignStatus } from "../../domain/enums/campaign-status.enum";
import StatisticsEmailCampaignModel from "../database/models/statistics-email-campaign.model";
import EmailScheduleModel from "../database/models/filters/schedules.models";
import AgeRangeModel from "../database/models/filters/age-range.models";
import CampaignModel from "../database/models/campaign.model";
import OperatorsModel from "../database/models/filters/operators.models";
import PlansModel from "../database/models/filters/plans.models";
import ContractStatusModel from "../database/models/filters/contract-status.models";
import UfModel from "../database/models/filters/uf.models";
import ValidityModel from "../database/models/filters/validity.model";
import Campaign from "../../domain/entities/interfaces/campaign.interface";
import ShortFullEmailCampaign from "../../domain/entities/interfaces/email-campaign/full-email-campaign.interface";
import ICampaignRepository from "../../domain/contracts/repositories/ICampaignRepository";

class CampaignRepository implements ICampaignRepository {
    async save(campaign: Campaign): Promise<Campaign>{
        console.log('Recebido da controller: ', campaign);

        const createDBResult = await CampaignModel.create({
            campaignName: campaign.campaignName,
            subject: campaign.subject,
            status: campaign.status,
            typeCampaign: campaign.typeCampaign,
            templateId: campaign.templateId,
            // doSchedule: campaign.doSchedule,
            filterByAgeRange: campaign.filterByAgeRange,
            filterByContractStatus: campaign.filterByContractStatus,
            // filterByModality: campaign.filterByModality,
            filterByOperator: campaign.filterByOperator,
            filterByPlan: campaign.filterByPlan,
            filterByUf: campaign.filterByUf,
            filterByValidity: campaign.filterByValidity,
        });

        console.log(createDBResult);
        const pureObject = createDBResult.get({plain: true}) as Campaign;

        if (!pureObject) throw new Error('Ocorreu algum erro ao salvar a campanha');

        return pureObject;
    }

    async findAll(typeCampaign: string): Promise<Campaign[]> {
        const campaignsDB = await CampaignModel.findAll({
            where: {typeCampaign},
            order: [['createdAt', 'DESC']]
        });

        let response: Campaign[] = [];

        campaignsDB.forEach(ec => {
            const pureObject = ec.get({plain: true});
            
            response.push(pureObject);
        });
        return response;
    }

    async findById(id: number): Promise<ShortFullEmailCampaign> {
        try {
            console.log("Entramos para procurar campanha pelo id");
    
            const emailCampaignDB = await CampaignModel.findByPk(id, {
                include: [
                    {model: CampaignTemplateModel},
                    {model: StatisticsEmailCampaignModel},
                    {model: EmailScheduleModel},
                    {model: AgeRangeModel},
                    {model: OperatorsModel},
                    {model: PlansModel},
                    {model: ContractStatusModel},
                    {model: ValidityModel},
                    {model: UfModel}
                ]
            });
    
            // console.log('PIPOPOROPOPO: ', emailCampaign);
    
            if (!emailCampaignDB) throw new Error("Error");
    
            const pureObject: any = emailCampaignDB.get({plain: true});
            console.log('dsffdsfsdf',pureObject);
            

            const campaign: ShortFullEmailCampaign = {
                campaign: {
                    id: pureObject.id,
                    campaignName: pureObject.campaignName,
                    subject: pureObject.subject,
                    status: pureObject.status,
                    typeCampaign: pureObject.typeCampaign,
                    templateId: pureObject.templateId ?? null,
                    // doSchedule: boolean | null,
                    filterByAgeRange: pureObject.filterByAgeRange,
                    filterByContractStatus: pureObject.filterByContractStatus,
                    filterByOperator: pureObject.filterByOperator,
                    filterByPlan: pureObject.filterByPlan,
                    filterByUf: pureObject.filterByUf,
                    filterByValidity: pureObject.filterByValidity,
                    createdAt: pureObject.createdAt,
                    updatedAt: pureObject.updatedAt ?? null,
                },
                campaignTemplateModel: pureObject.CampaignTemplateModel ?? null,
                statisticsEmailCampaign: pureObject.StatisticsEmailCampaignModel ?? null,
                emailSchedule: pureObject.EmailScheduleModel ?? null,
                ageRange: pureObject.AgeRangeModel ?? null,
                operators: pureObject.OperatorsModels ?? null,
                plans: pureObject.PlansModels ?? null,
                contractStatuses: pureObject.ContractStatusModels ?? null,
                validity: pureObject.ValidityModel ?? null,
                ufs: pureObject.UfModels ?? null,
            }

            console.log('Resultado final do objeto puro: ', pureObject);
            console.log('Resultado final: ', campaign);
    
            return campaign;
        } catch (error) {
            console.error('Erro ao buscar campanha com associações:', error);
            throw error;
        }
    }

    async update(payload: Campaign): Promise<string> {
        if (!payload) throw new Error(`Erro! Não veio payload: ${payload}`);

        try {
            const [affectedCount] = await CampaignModel.update(
                payload,
                {where: {id: payload.id}}
            );
            
            return affectedCount > 0 ? 'Campanha de email atualizada com sucesso.' : 'Nenhuma linha da campanha atualizada. Falhou';
        } catch (error) {
            console.log('Erro na edição das informações base da campanha: ', error);
            return '';
        }
        
    }

    async updateEmailTemplateId(emailTemplateId: number, emailCampaign: CampaignEntity): Promise<string> {
        if (!emailTemplateId || !emailCampaign.baseInformations.id) throw new Error("error");

        const [affectedCount] = await CampaignModel.update(
            {templateId: emailTemplateId},
            { where: { id: emailCampaign.baseInformations.id }}, // Assumindo que EmailCampaign tem um campo 'id'
        );

        return affectedCount > 0 ? 'Campanha de email e template salvos e atribuidos com sucesso.' : 'Falhou. Nenhuma campanha de email atualizada.';
    }
    
    async delete(id: number): Promise<string> {
        console.log('Entramos no repository: ', id);
        
        const result = await CampaignModel.destroy({
            where: { id: id },
        });

        console.log('Veja: ', result);

        return result > 0 ? 'Deletado com sucesso' : 'Falha na deleção';
    }

    async updateStatus(id: number, status: CampaignStatus): Promise<[number]> {
        return CampaignModel.update(
            { status: status }, 
            { where: { id: id } }
        );
    }

    async getStatus(campaignId: number) {
        try {
            const status = await CampaignModel.findOne({
                where: {id: campaignId},
                attributes: ['status']
            });

            if(!status) throw new Error('Não encontrado nenhuma campanha com o id passado');

            const currentStatus = status.get({plain: true});
    
            return currentStatus;
        } catch (error) {
            console.error('O Error é o seguinte: ', error);
            
            throw new Error('Ocorreu algum erro ao buscar status da campanha');
        }
    }
    
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
}

export default CampaignRepository;