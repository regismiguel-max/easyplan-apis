import { Model, Transaction } from "sequelize";
import StatisticsEmailCampaignModel, {
    StatisticsEmailCampaignAttributes,
    StatisticsEmailCampaignCreationAttributes
} from "../database/models/statistics-email-campaign.model";

import connection_db from "../database/config/database";
import FailedEmailModel from "../database/models/failed-emails.model";

export default class EmailCampaignStatisticsService {

    /**
     * Inicializa as estatísticas para uma nova campanha
     */
    public async initializeStatistics(
        emailCampaignId: number,
        recipientsCount: number,
        transaction?: Transaction
    ): Promise<Model<StatisticsEmailCampaignAttributes, StatisticsEmailCampaignCreationAttributes>> {
        try {
            const [statistics, created] = await StatisticsEmailCampaignModel.findOrCreate({
                where: { emailCampaignId },
                defaults: { 
                    emailCampaignId,
                    countsRecipients: recipientsCount
                },
                transaction
            });

            if (created) {
                console.log(`✅ Estatísticas inicializadas para campanha ${emailCampaignId} com ${recipientsCount} destinatários.`);
            } else {
                console.warn(`⚠️ Estatísticas já existiam para campanha ${emailCampaignId}.`);
            }

            return statistics;
        } catch (error) {
            console.error("❌ Erro ao inicializar estatísticas:", error);
            throw new Error(`Falha ao inicializar estatísticas: ${error}`);
        }
    }

    /**
     * Busca ou cria as estatísticas se não existirem (fail-safe)
     */
    private async getOrCreateStatistics(emailCampaignId: number, transaction: Transaction) {
        let statistics = await StatisticsEmailCampaignModel.findOne({
            where: { emailCampaignId },
            transaction
        });

        if (!statistics) {
            statistics = await StatisticsEmailCampaignModel.create({
                emailCampaignId,
                countsRecipients: 0
            }, { transaction });

            console.warn(`⚠️ Estatísticas não encontradas para campanha ${emailCampaignId}. Criadas automaticamente.`);
        }

        return statistics;
    }

    /**
     * Processa evento 'processed'
     */
    public async processProcessedEvent(emailCampaignId: number, timestamp: Date) {
        const transaction = await connection_db.transaction();
        try {
            const statistics = await this.getOrCreateStatistics(emailCampaignId, transaction);

            await statistics.increment('processed', { by: 1, transaction });
            await statistics.reload({ transaction });

            const updates: any = {};

            if (!statistics.getDataValue('firstProcessedAt')) {
                updates.firstProcessedAt = timestamp;
            }
            updates.lastProcessedAt = timestamp;

            if (Object.keys(updates).length) {
                await statistics.update(updates, { transaction });
            }

            await transaction.commit();
            console.log(`✅ Evento 'processed' registrado para campanha ${emailCampaignId}`);
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao processar evento processed:', error);
            throw error;
        }
    }

    /**
     * Processa evento 'delivered'
     */
    public async processDeliveredEvent(emailCampaignId: number, timestamp: Date) {
        const transaction = await connection_db.transaction();
        try {
            const statistics = await this.getOrCreateStatistics(emailCampaignId, transaction);

            await statistics.increment('delivered', { by: 1, transaction });
            await statistics.reload({ transaction });

            const currentDelivered = statistics.getDataValue('delivered');
            const recipientsCount = statistics.getDataValue('countsRecipients');
            const openCount = statistics.getDataValue('open');

            const updates: any = {};

            if (!statistics.getDataValue('firstDeliveredAt')) {
                updates.firstDeliveredAt = timestamp;
            }
            updates.lastDeliveredAt = timestamp;

            if (recipientsCount > 0) {
                updates.deliveryRate = (currentDelivered / recipientsCount) * 100;
            }
            if (currentDelivered > 0) {
                updates.openRate = (openCount / currentDelivered) * 100;
            }

            if (Object.keys(updates).length) {
                await statistics.update(updates, { transaction });
            }

            await transaction.commit();
            console.log(`✅ Evento 'delivered' registrado para campanha ${emailCampaignId}`);
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao processar evento delivered:', error);
            throw error;
        }
    }

    /**
     * Processa evento 'open'
     */
    public async processOpenEvent(emailCampaignId: number, timestamp: Date) {
        const transaction = await connection_db.transaction();
        try {
            const statistics = await this.getOrCreateStatistics(emailCampaignId, transaction);

            await statistics.increment('open', { by: 1, transaction });
            await statistics.reload({ transaction });

            const currentOpen = statistics.getDataValue('open');
            const deliveredCount = statistics.getDataValue('delivered');

            const updates: any = {};

            if (!statistics.getDataValue('firstOpenAt')) {
                updates.firstOpenAt = timestamp;
            }
            updates.lastOpenAt = timestamp;

            if (deliveredCount > 0) {
                updates.openRate = (currentOpen / deliveredCount) * 100;
            }

            if (Object.keys(updates).length) {
                await statistics.update(updates, { transaction });
            }

            await transaction.commit();
            console.log(`✅ Evento 'open' registrado para campanha ${emailCampaignId}`);
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao processar evento open:', error);
            throw error;
        }
    
    }
    /**
     * Processa evento 'click'
     */
    public async processClickEvent(emailCampaignId: number, timestamp: Date) {
        const transaction = await connection_db.transaction();
        try {
            const statistics = await this.getOrCreateStatistics(emailCampaignId, transaction);

            await statistics.increment('click', { by: 1, transaction });
            await statistics.reload({ transaction });

            await transaction.commit();
            console.log(`✅ Evento 'open' registrado para campanha ${emailCampaignId}`);
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao processar evento open:', error);
            throw error;
        }
    }

    /**
     * Processa evento 'dropped'
     */
    public async processDroppedEvent(campaignId: number, timestamp: Date, emailRecipient: string, event: string, reason: string) {
        const transaction = await connection_db.transaction();
        try {
            const statistics = await this.getOrCreateStatistics(campaignId, transaction);

            await statistics.increment('dropped', { by: 1, transaction });
            await statistics.reload({ transaction });

            await transaction.commit();
            console.log(`✅ Evento 'dropped' registrado para campanha ${campaignId} ${reason ? `(Motivo: ${reason})` : ''}`);

            const result = await FailedEmailModel.create({
                campaignId,
                event,
                emailRecipient,
                reason
            });

            if(!result) { throw new Error(`Houve algum erro na persistência dos emails que falharam - Campanha de id ${campaignId}`); }

            console.log('Failed email persistido');
            
            return;
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao processar evento dropped:', error);
            throw error;
        }
    }

    public async processBounceEvent(campaignId: number, timestamp: Date, emailRecipient: string, event: string, reason: string) {
        const transaction = await connection_db.transaction();
        try {
            const statistics = await this.getOrCreateStatistics(campaignId, transaction);

            await statistics.increment('bounce', { by: 1, transaction });
            await statistics.reload({ transaction });

            await transaction.commit();
            console.log(`✅ Evento 'bounce' registrado para campanha ${campaignId} ${reason ? `(Motivo: ${reason})` : ''}`);

            const result = await FailedEmailModel.create({
                campaignId,
                event,
                emailRecipient,
                reason
            });

            if(!result) { throw new Error(`Houve algum erro na persistência dos emails que falharam - Campanha de id ${campaignId}`); }

            console.log('Failed email persistido');
            
            return;
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao processar evento dropped:', error);
            throw error;
        }
    }

    /**
     * Retorna estatísticas da campanha
     */
    public async getStatistics(emailCampaignId: number) {
        try {
            return await StatisticsEmailCampaignModel.findOne({
                where: { emailCampaignId }
            });
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            throw error;
        }
    }

    /**
     * Roteador de eventos genérico
     */
    public async processEvent(
        emailCampaignId: number,
        eventType: string,
        timestamp: Date,
        emailRecipient: string,
        reason: string,
        metadata?: Record<string, any>
    ) {
        switch (eventType) {
            case 'processed':
                await this.processProcessedEvent(emailCampaignId, timestamp);
                break;
            case 'delivered':
                await this.processDeliveredEvent(emailCampaignId, timestamp);
                break;
            case 'open':
                await this.processOpenEvent(emailCampaignId, timestamp);
                break;
            case 'click':
                await this.processClickEvent(emailCampaignId, timestamp);
                break;
            case 'dropped':
                await this.processDroppedEvent(emailCampaignId, timestamp, emailRecipient, eventType, reason);
                break;
            case 'bounce':
                await this.processBounceEvent(emailCampaignId, timestamp, emailRecipient, eventType, reason);
                break;
            default:
                console.warn(`⚠️ Evento desconhecido: ${eventType}`);
                break;
        }
    }
}
