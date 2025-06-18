import { Op } from "sequelize";
import CampaignMessageStatusesModel from "../database/models/campaign-message-statuses.model";
import StatisticsWhatsCampaignModel from "../database/models/statistics-whats-campaign.model";
import { Payload } from "../providers/whatsapp-campaign-sender.provider";

export default class StatisticsWhatsCampaignRepository {
    async create(recipientGroup: number, campaignId: number): Promise<void>{
        const statistics = await StatisticsWhatsCampaignModel.create({
            campaignId,
            countsRecipients: recipientGroup
        })
        console.log(statistics);

        return;
    }

    async get(campaignId: number) {
        const statistic = await StatisticsWhatsCampaignModel.findOne(
            {
                where: {campaignId}
            }
        );

        if(!statistic) throw new Error('Não existe estatística para o id de campanha passado');

        const pureObject = statistic.get({plain: true});

        return pureObject
    }

    async update(payload: any, id: number) {
        console.log('Iniciar atualização statistics: ', payload);

        const affectedRows = await StatisticsWhatsCampaignModel.update(
            {
                sent: payload.sent,
                failed: payload.failed,
                sentRate: payload.sentRate
            },
            {
                where: {id}
            }
        );
        console.log('Atualizar statistics não deu error');

        return affectedRows.length <= 0 ? 'Atualização falhou' : 'Atualização ocorrida com sucesso';
    }

    async delete(id: number): Promise<string> {
        console.log('Entramos no repository: ', id);
        
        const result = await StatisticsWhatsCampaignModel.destroy({
            where: { campaignId: id },
        });

        if (result === 0)  'Não foi encontrado nenhum registro com o id passado - Falha';

        return 'Deletado com sucesso';
    }

    async createMessageStatus(payload: Payload) {
        if(!payload.campaignId) throw new Error('Não veio campaignId para salvar messageStatuses');
        if(!payload.chunkIndex) throw new Error('Não veio chunkIndex para salvar messageStatuses');

        const responseDB = await CampaignMessageStatusesModel.create(
            {
                campaignId: payload.campaignId,
                number: payload.number,
                idMessage: payload.idMessage,
                chunkIndex: payload.chunkIndex
            }
        )

        const pureObject = responseDB.get({plain: true});

        console.log('Message status criado: ', pureObject);
    }

    async getMessageStatus() {
        const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);

        return CampaignMessageStatusesModel.findAll({
            where: {
                checked: false,
                createdAt: {
                    [Op.gte]: fiveHoursAgo
                }
            },
            order: [['createdAt', 'ASC']],
        });
    }
    async getMessageStatusByCampaignId(campaignId: number) {
        return CampaignMessageStatusesModel.findAll(
            {
                where: { campaignId },
            }
        );
    }

    async updateStatus(campaignId: number, status: string, idMessage: number) {
        await CampaignMessageStatusesModel.update(
            {
                status,
                checked: true
            },
            {
                where: {
                    campaignId,
                    idMessage
                }
            }
        )
    }
}