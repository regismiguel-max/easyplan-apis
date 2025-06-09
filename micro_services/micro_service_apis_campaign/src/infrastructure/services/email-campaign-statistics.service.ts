// services/email-campaign-statistics.service.ts
import { Model, Transaction } from "sequelize";
import StatisticsEmailCampaignModel, { StatisticsEmailCampaignAttributes, StatisticsEmailCampaignCreationAttributes } from "../database/models/statistics-email-campaign.model";
import connection_db from "../database/config/database";

export default class EmailCampaignStatisticsService {
    /**
     * Inicializa as estatísticas para uma nova campanha
     * @param emailCampaignId ID da campanha
     * @param recipientsCount Número de destinatários
     * @param transaction Transação opcional do Sequelize
     */
    public async initializeStatistics(
        emailCampaignId: number, 
        recipientsCount: number,
        transaction?: Transaction
    ): Promise<Model<StatisticsEmailCampaignAttributes, StatisticsEmailCampaignCreationAttributes>> {
        try {
            const statisticsData: StatisticsEmailCampaignCreationAttributes = {
                emailCampaignId,
                countsRecipients: recipientsCount,
                // Os outros campos terão seus valores padrão (0)
            };

            const statistics = await StatisticsEmailCampaignModel.create(
                statisticsData, 
                { transaction }
            );

            console.log(`Estatísticas inicializadas para campanha ${emailCampaignId} com ${recipientsCount} destinatários`);
            return statistics;
        } catch (error) {
            console.error('Erro ao inicializar estatísticas:', error);
            throw new Error(`Falha ao inicializar estatísticas: ${error}`);
        }
    }

    /**
     * Processa um evento de e-mail processado
     * @param emailCampaignId ID da campanha
     * @param timestamp Timestamp do evento
     */
    public async processProcessedEvent(emailCampaignId: number, timestamp: Date): Promise<void> {
        const transaction = await connection_db.transaction();
        
        try {
            // Buscar estatísticas atuais
            const statistics = await StatisticsEmailCampaignModel.findOne({
                where: { emailCampaignId },
                transaction
            });

            if (!statistics) {
                throw new Error(`Estatísticas não encontradas para campanha ${emailCampaignId}`);
            }

            // Incrementar contador
            await statistics.increment('processed', { by: 1, transaction });

            // Atualizar timestamps
            const updates: any = {};
            
            if (!statistics.getDataValue('firstProcessedAt')) {
                updates.firstProcessedAt = timestamp;
            }
            
            updates.lastProcessedAt = timestamp;

            // Atualizar taxas
            // const currentProcessed = statistics.getDataValue('processed') + 1; // +1 porque acabamos de incrementar // Acredito que nesse caso não seja necessário
            // const recipientsCount = statistics.getDataValue('countsRecipients');
            
            // if (recipientsCount > 0) {
            //     updates.deliveryRate = (statistics.getDataValue('delivered') / recipientsCount) * 100;
            // }

            // Aplicar atualizações
            if (Object.keys(updates).length > 0) {
                await statistics.update(updates, { transaction });
            }

            await transaction.commit();
            console.log(`Evento 'processed' registrado para campanha ${emailCampaignId}`);
        } catch (error) {
            await transaction.rollback();
            console.error('Erro ao processar evento processed:', error);
            throw error;
        }
    }

    /**
     * Processa um evento de e-mail entregue
     * @param emailCampaignId ID da campanha
     * @param timestamp Timestamp do evento
     */
    public async processDeliveredEvent(emailCampaignId: number, timestamp: Date): Promise<void> {
        const transaction = await connection_db.transaction();
        
        try {
            // Buscar estatísticas atuais
            const statistics = await StatisticsEmailCampaignModel.findOne({
                where: { emailCampaignId },
                transaction
            });

            if (!statistics) {
                throw new Error(`Estatísticas não encontradas para campanha ${emailCampaignId}`);
            }

            // Incrementar contador
            await statistics.increment('delivered', { by: 1, transaction });

            // Atualizar timestamps
            const updates: any = {};
            
            if (!statistics.getDataValue('firstDeliveredAt')) {
                updates.firstDeliveredAt = timestamp;
            }
            
            updates.lastDeliveredAt = timestamp;

            // Atualizar taxas
            const currentDelivered = statistics.getDataValue('delivered') + 1; // +1 porque acabamos de incrementar
            const recipientsCount = statistics.getDataValue('countsRecipients');
            const openCount = statistics.getDataValue('open');
            
            if (recipientsCount > 0) {
                updates.deliveryRate = (currentDelivered / recipientsCount) * 100;
            }
            
            if (currentDelivered > 0) {
                updates.openRate = (openCount / currentDelivered) * 100;
            }

            // Aplicar atualizações
            if (Object.keys(updates).length > 0) {
                await statistics.update(updates, { transaction });
            }

            await transaction.commit();
            console.log(`Evento 'delivered' registrado para campanha ${emailCampaignId}`);
        } catch (error) {
            await transaction.rollback();
            console.error('Erro ao processar evento delivered:', error);
            throw error;
        }
    }

    /**
     * Processa um evento de e-mail aberto
     * @param emailCampaignId ID da campanha
     * @param timestamp Timestamp do evento
     */
    public async processOpenEvent(emailCampaignId: number, timestamp: Date): Promise<void> {
        const transaction = await connection_db.transaction();
        
        try {
            // Buscar estatísticas atuais
            const statistics = await StatisticsEmailCampaignModel.findOne({
                where: { emailCampaignId },
                transaction
            });

            if (!statistics) {
                throw new Error(`Estatísticas não encontradas para campanha ${emailCampaignId}`);
            }

            // Incrementar contador
            await statistics.increment('open', { by: 1, transaction });

            // Atualizar timestamps
            const updates: any = {};
            
            if (!statistics.getDataValue('firstOpenAt')) {
                updates.firstOpenAt = timestamp;
            }
            
            updates.lastOpenAt = timestamp;

            // Atualizar taxas
            const currentOpen = statistics.getDataValue('open') + 1; // +1 porque acabamos de incrementar
            const deliveredCount = statistics.getDataValue('delivered');
            
            if (deliveredCount > 0) {
                updates.openRate = (currentOpen / deliveredCount) * 100;
            }

            // Aplicar atualizações
            if (Object.keys(updates).length > 0) {
                await statistics.update(updates, { transaction });
            }

            await transaction.commit();
            console.log(`Evento 'open' registrado para campanha ${emailCampaignId}`);
        } catch (error) {
            await transaction.rollback();
            console.error('Erro ao processar evento open:', error);
            throw error;
        }
    }

    /**
     * Processa um evento de e-mail descartado
     * @param emailCampaignId ID da campanha
     * @param timestamp Timestamp do evento
     * @param reason Motivo do descarte (opcional)
     */
    public async processDroppedEvent(emailCampaignId: number, timestamp: Date, reason?: string): Promise<void> {
        const transaction = await connection_db.transaction();
        
        try {
            // Buscar estatísticas atuais
            const statistics = await StatisticsEmailCampaignModel.findOne({
                where: { emailCampaignId },
                transaction
            });

            if (!statistics) {
                throw new Error(`Estatísticas não encontradas para campanha ${emailCampaignId}`);
            }

            // Incrementar contador
            await statistics.increment('dropped', { by: 1, transaction });

            // Não há timestamps específicos para dropped no nosso modelo atual
            // Poderíamos adicionar se necessário

            // Atualizar taxas (se necessário)
            // Não estamos calculando uma taxa específica para dropped no momento

            await transaction.commit();
            console.log(`Evento 'dropped' registrado para campanha ${emailCampaignId}${reason ? ` (Motivo: ${reason})` : ''}`);
        } catch (error) {
            await transaction.rollback();
            console.error('Erro ao processar evento dropped:', error);
            throw error;
        }
    }

    /**
     * Processa um evento de clique em link
     * @param emailCampaignId ID da campanha
     * @param timestamp Timestamp do evento
     * @param url URL clicada (opcional)
     */
    // public async processClickEvent(emailCampaignId: number, timestamp: Date, url?: string): Promise<void> {
    //     const transaction = await connection_db.transaction();
        
    //     try {
    //         // Buscar estatísticas atuais
    //         const statistics = await StatisticsEmailCampaignModel.findOne({
    //             where: { emailCampaignId },
    //             transaction
    //         });

    //         if (!statistics) {
    //             throw new Error(`Estatísticas não encontradas para campanha ${emailCampaignId}`);
    //         }

    //         // Incrementar contador
    //         await statistics.increment('click', { by: 1, transaction });

    //         // Poderíamos adicionar timestamps para clicks se necessário
    //         // E também calcular uma taxa de cliques (CTR)

    //         await transaction.commit();
    //         console.log(`Evento 'click' registrado para campanha ${emailCampaignId}${url ? ` (URL: ${url})` : ''}`);
    //     } catch (error) {
    //         await transaction.rollback();
    //         console.error('Erro ao processar evento click:', error);
    //         throw error;
    //     }
    // }

    /**
     * Processa um evento de spam report
     * @param emailCampaignId ID da campanha
     * @param timestamp Timestamp do evento
     */
    // public async processSpamEvent(emailCampaignId: number, timestamp: Date): Promise<void> {
    //     const transaction = await connection_db.transaction();
        
    //     try {
    //         // Buscar estatísticas atuais
    //         const statistics = await StatisticsEmailCampaignModel.findOne({
    //             where: { emailCampaignId },
    //             transaction
    //         });

    //         if (!statistics) {
    //             throw new Error(`Estatísticas não encontradas para campanha ${emailCampaignId}`);
    //         }

    //         // Incrementar contador
    //         await statistics.increment('spam', { by: 1, transaction });

    //         await transaction.commit();
    //         console.log(`Evento 'spam' registrado para campanha ${emailCampaignId}`);
    //     } catch (error) {
    //         await transaction.rollback();
    //         console.error('Erro ao processar evento spam:', error);
    //         throw error;
    //     }
    // }

    /**
     * Processa um evento de unsubscribe
     * @param emailCampaignId ID da campanha
     * @param timestamp Timestamp do evento
     */
    // public async processUnsubscribeEvent(emailCampaignId: number, timestamp: Date): Promise<void> {
    //     const transaction = await connection_db.transaction();
        
    //     try {
    //         // Buscar estatísticas atuais
    //         const statistics = await StatisticsEmailCampaignModel.findOne({
    //             where: { emailCampaignId },
    //             transaction
    //         });

    //         if (!statistics) {
    //             throw new Error(`Estatísticas não encontradas para campanha ${emailCampaignId}`);
    //         }

    //         // Incrementar contador
    //         await statistics.increment('unsubscribe', { by: 1, transaction });

    //         await transaction.commit();
    //         console.log(`Evento 'unsubscribe' registrado para campanha ${emailCampaignId}`);
    //     } catch (error) {
    //         await transaction.rollback();
    //         console.error('Erro ao processar evento unsubscribe:', error);
    //         throw error;
    //     }
    // }

    /**
     * Processa um evento de bounce
     * @param emailCampaignId ID da campanha
     * @param timestamp Timestamp do evento
     * @param reason Motivo do bounce (opcional)
     */
    // public async processBounceEvent(emailCampaignId: number, timestamp: Date, reason?: string): Promise<void> {
    //     const transaction = await connection_db.transaction();
        
    //     try {
    //         // Buscar estatísticas atuais
    //         const statistics = await StatisticsEmailCampaignModel.findOne({
    //             where: { emailCampaignId },
    //             transaction
    //         });

    //         if (!statistics) {
    //             throw new Error(`Estatísticas não encontradas para campanha ${emailCampaignId}`);
    //         }

    //         // Incrementar contador
    //         await statistics.increment('bounce', { by: 1, transaction });

    //         await transaction.commit();
    //         console.log(`Evento 'bounce' registrado para campanha ${emailCampaignId}${reason ? ` (Motivo: ${reason})` : ''}`);
    //     } catch (error) {
    //         await transaction.rollback();
    //         console.error('Erro ao processar evento bounce:', error);
    //         throw error;
    //     }
    // }

    /**
     * Obtém as estatísticas de uma campanha
     * @param emailCampaignId ID da campanha
     */
    public async getStatistics(emailCampaignId: number): Promise<Model<StatisticsEmailCampaignAttributes, StatisticsEmailCampaignCreationAttributes> | null> {
        try {
            return await StatisticsEmailCampaignModel.findOne({
                where: { emailCampaignId }
            });
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            throw error;
        }
    }

    /**
     * Processa um evento genérico baseado no tipo
     * @param emailCampaignId ID da campanha
     * @param eventType Tipo do evento
     * @param timestamp Timestamp do evento
     * @param metadata Metadados adicionais do evento
     */
    public async processEvent(
        emailCampaignId: number, 
        eventType: string, 
        timestamp: Date,
        metadata?: Record<string, any>
    ): Promise<void> {
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
            // case 'click':
            //     await this.processClickEvent(emailCampaignId, timestamp, metadata?.url);
            //     break;
            // case 'bounce':
            //     await this.processBounceEvent(emailCampaignId, timestamp, metadata?.reason);
            //     break;
            case 'dropped':
                await this.processDroppedEvent(emailCampaignId, timestamp, metadata?.reason);
                break;
            // case 'spam':
            //     await this.processSpamEvent(emailCampaignId, timestamp);
            //     break;
            // case 'unsubscribe':
            //     await this.processUnsubscribeEvent(emailCampaignId, timestamp);
            //     break;
            default:
                console.warn(`Tipo de evento desconhecido: ${eventType}`);
        }
    }
}