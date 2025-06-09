import IEmailCampaignRepository from "../../domain/contracts/repositories/IEmailCampaignRepository";
import EmailCampaignEntity from "../../domain/entities/EmailCampaign";
import EmailTemplateModel from "../database/models/email-template.model";
import { EmailCampaignStatus } from "../../domain/types/email-status.types";
import StatisticsEmailCampaignModel from "../database/models/statistics-email-campaign.model";
import EmailScheduleModel from "../database/models/filters/schedules.models";
import AgeRangeModel from "../database/models/filters/age-range.models";
import EmailCampaignModel, { EmailCampaignAttributes } from "../database/models/email-campaign.model";
import OperatorsModel from "../database/models/filters/operators.models";
import PlansModel from "../database/models/filters/plans.models";
import ContractStatusModel from "../database/models/filters/contract-status.models";
import UfModel from "../database/models/filters/uf.models";
import ClientModel from "../database/models/client.model";
import RecipientGroupModel from "../database/models/recipient-group.models";
import ValidityModel from "../database/models/filters/validity.model";
import DataToSave from "../../domain/entities/interfaces/email-campaign/data-to-save.interface";
import EmailCampaign from "../../domain/entities/interfaces/email-campaign/email-campaign.interface";
import FullEmailCampaign, { ShortFullEmailCampaign } from "../../domain/entities/interfaces/email-campaign/full-email-campaign.interface";
import RecipientGroup, { RecipientGroupToSend } from "../../domain/entities/interfaces/email-campaign/recipient-group.interface";
import { WhereOptions } from "sequelize";

class EmailCampaignRepository implements IEmailCampaignRepository {
    async save(campaign: EmailCampaign): Promise<EmailCampaign> {
        console.log('Recebido da controller: ', campaign);

        const createDBResult = await EmailCampaignModel.create({
            campaignName: campaign.campaignName,
            subject: campaign.subject,
            status: campaign.status,
            emailTemplateId: campaign.emailTemplateId,
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
        const pureObject = createDBResult.get({ plain: true }) as EmailCampaign;

        if (!pureObject) throw new Error('Ocorreu algum erro ao salvar a campanha');

        return pureObject;
    }

    async findAll(): Promise<EmailCampaign[]> {
        const emailCampaignsDB = await EmailCampaignModel.findAll({ order: [['createdAt', 'DESC']] });

        let response: EmailCampaign[] = [];

        emailCampaignsDB.forEach(ec => {
            const pureObject = ec.get({ plain: true });

            response.push(pureObject);
        })
        return response;
    }

    async findById(id: number): Promise<ShortFullEmailCampaign> {
        try {
            console.log("Entramos para procurar campanha pelo id");

            const emailCampaignDB = await EmailCampaignModel.findByPk(id, {
                include: [
                    { model: EmailTemplateModel },
                    { model: StatisticsEmailCampaignModel },
                    { model: EmailScheduleModel },
                    { model: AgeRangeModel },
                    { model: OperatorsModel },
                    { model: PlansModel },
                    { model: ContractStatusModel },
                    { model: ValidityModel },
                    { model: UfModel }
                ]
            });

            // console.log('PIPOPOROPOPO: ', emailCampaign);

            if (!emailCampaignDB) throw new Error("Error");

            const pureObject: any = emailCampaignDB.get({ plain: true });

            const emailCampaign: ShortFullEmailCampaign = {
                emailCampaign: {
                    id: pureObject.id,
                    campaignName: pureObject.campaignName,
                    subject: pureObject.subject,
                    status: pureObject.status,
                    emailTemplateId: pureObject.emailTemplateId ?? null,
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
                emailTemplateModel: pureObject.EmailTemplateModel ?? null,
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
            console.log('Resultado final: ', emailCampaign);

            return emailCampaign;
        } catch (error) {
            console.error('Erro ao buscar campanha com associações:', error);
            throw error;
        }
    }

    async update(payload: EmailCampaign): Promise<string> {
        if (!payload) throw new Error(`Erro! Não veio payload: ${payload}`);

        try {
            const [affectedCount] = await EmailCampaignModel.update(
                payload,
                { where: { id: payload.id } }
            );

            return affectedCount > 0 ? 'Campanha de email atualizada com sucesso.' : 'Nenhuma linha da campanha atualizada. Falhou';
        } catch (error) {
            console.log('Erro na edição das informações base da campanha: ', error);
            return '';
        }

    }

    async updateEmailTemplateId(emailTemplateId: number, campaign: EmailCampaignEntity): Promise<string> {
        if (!emailTemplateId || !campaign.emailCampaignBaseInformations.id) throw new Error("error");

        const [affectedCount] = await EmailCampaignModel.update(
            { emailTemplateId: emailTemplateId },
            { where: { id: campaign.emailCampaignBaseInformations.id } }, // Assumindo que EmailCampaign tem um campo 'id'
        );

        return affectedCount > 0 ? 'Campanha de email e template salvos e atribuidos com sucesso.' : 'Falhou. Nenhuma campanha de email atualizada.';
    }

    async delete(id: number): Promise<string> {
        console.log('Entramos no repository: ', id);

        const result = await EmailCampaignModel.destroy({
            where: { id: id },
        });

        return result > 0 ? 'Deletado com sucesso' : 'Falha na deleção';
    }

    async updateStatus(id: number, status: EmailCampaignStatus): Promise<[number]> {
        return EmailCampaignModel.update(
            { status: status },
            { where: { id: id } }
        );
    }

    //************************** RECIPIENT GROUP REPOSITORY ***************************/
    async getRecipientsByFilters(filters: WhereOptions): Promise<Partial<RecipientGroup>[] | string> {
        const recipientGroupDB = await ClientModel.findAll({
            where: filters,
            attributes: ['ddd_celular', 'celular', 'email_principal']
        });

        if (recipientGroupDB.length <= 0) return 'Não existe cliente(s) que atendam a esse conjunto de filtros';

        let response: Partial<RecipientGroup>[] = [];

        recipientGroupDB.forEach(recipient => {
            const pureObject = recipient.get({ plain: true });

            response.push(pureObject);
        });

        console.log('Grupo Destinatário - Manipulação realizada com sucesso: ', response);

        return response;
    }
    async saveRecipientsGroup(recipientsGroup: Partial<RecipientGroup>[], emailCampaignId: number): Promise<RecipientGroup[]> {
        const data: Partial<RecipientGroup>[] = recipientsGroup.map((rg) => ({
            emailCampaignId,
            ddd_celular: rg.ddd_celular,
            celular: rg.celular,
            email_principal: rg.email_principal
        }));

        console.log('Dado formatado para persistir: ', data);

        const recipientGroupSaved = await RecipientGroupModel.bulkCreate(data);

        if (!recipientGroupSaved) throw new Error('Erro ao salvar os grupos destinatários');

        const recipientsGroupResponse: RecipientGroup[] = recipientGroupSaved.map(recipientGroup => recipientGroup.get({ plain: true }))

        console.log('RG salvo e manipulado: ', recipientsGroupResponse);

        return recipientsGroupResponse;
    }
    async deleteRecipientsGroup(emailCampaignId: number): Promise<string> {
        try {
            const deleteResponse = await RecipientGroupModel.destroy({
                where: { emailCampaignId }
            });

            console.log(deleteResponse);

            if (deleteResponse === 0) 'Não foi encontrado nenhum registro com o id passado - Falha';

            return 'Deletado com sucesso';
        } catch (error) {
            throw new Error(`Ocorreu algum erro ao deletar a tabela de grupo destinatário: ${ error }`);
        }
    }
    async getRecipientGroupById(emailCampaignId: number): Promise<RecipientGroupToSend> {
        const { rows, count } = await RecipientGroupModel.findAndCountAll({
            where: { emailCampaignId }
        });

        if (rows.length <= 0) throw new Error('Não existe grupo destinatário para essa campanha');

        let recipientsGroup: RecipientGroup[] = [];

        rows.forEach(rg => {
            const pureObject = rg.get({ plain: true })

            recipientsGroup.push(pureObject);
        });

        const response: RecipientGroupToSend = {
            recipientsGroup,
            count
        }

        console.log('Dado final de RecipientGroup Repository: ', response);

        return response;
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

export default EmailCampaignRepository;