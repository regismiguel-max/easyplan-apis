import EmailCampaignRepository from "../../../infrastructure/repositories/email-campaign.repository";
import { createClient } from 'redis';
import EmailCampaignStatisticsService from "../../../infrastructure/services/email-campaign-statistics.service";

const clientRedis = createClient().on('error', err => console.log('Redis Client Error', err)).connect();

const EXPIRATION_SECONDS = 7 * 24 * 60 * 60;

export default class WebHookSendGridUseCase {
    private statisticsService: EmailCampaignStatisticsService;

    constructor(private emailCampaignRepository: EmailCampaignRepository) {
        this.statisticsService = new EmailCampaignStatisticsService();
    }

    /**
     * Processa eventos recebidos do webhook do SendGrid
     * @param eventStatistics Array de eventos recebidos
     */
    public async handleWebHook(eventStatistics: any[]) {
        console.log(`Processando ${eventStatistics.length} eventos do SendGrid`);

        let newEventsCount = 0;
        let duplicateEventsCount = 0;
        let errorEventsCount = 0;

        for (const event of eventStatistics) {
            try {
                const campaignId = parseInt(event.idCampanha);
                const eventType = event.event;
                const email = event.email;
                const messageId = event.sg_message_id;
                const timestamp = new Date(event.timestamp * 1000); // Converter timestamp Unix para Date

                // Verificar se temos todas as informações necessárias
                if (!campaignId || !eventType || !messageId) {
                    console.warn('Evento com informações incompletas:', event);
                    continue;
                }

                // Gerar ID único para o evento
                const eventId = `${event.nomeCampanha}:${event.idCampanha}:${event.event}:${event.email}:${event.sg_message_id}`;
                const redisKey = `sendgrid:event:${eventId}`;

                console.log('O id do evento gerado: ', eventId);
                console.log('A chave criada: ', redisKey);
                console.log(`Processando evento: ${eventType} para campanha ${campaignId}, email ${email}`);

                // Verificar se o evento já foi processado (usando Redis)
                const exists = await (await clientRedis).exists(redisKey);
                if (exists === 1) {
                    console.log(`Evento duplicado detectado: ${eventId}`);
                    duplicateEventsCount++;
                    continue;
                }

                // Verificar se o evento é mais antigo que o envio da campanha
                // Extrair data de envio dos customArgs ou usar a data de criação da campanha
                const dataEnvioStr = event.dataEnvio;
                const dataEnvio = new Date(dataEnvioStr);

                // Ajustar para o fuso horário correto se necessário
                // Aqui estamos subtraindo 1 hora para compensar diferenças de fuso
                // const adjustedDataEnvio = new Date(dataEnvio.getTime() - 60 * 60 * 1000);
                const dataEvento = new Date(event.timestamp * 1000); // Convertendo timestamp Unix para JS Date

                console.log('Envio: ', dataEnvio);
                console.log('Evento: ', dataEvento);
    
                if (dataEvento < dataEnvio) {
                    console.log(`Descartando evento atrasado: ${eventType} (${timestamp.toISOString()} < ${dataEnvio.toISOString()})`);
                    continue;
                }
    
                // NOVO EVENTO
                // Processar o evento usando o serviço de estatísticas
                await this.statisticsService.processEvent(campaignId, eventType, timestamp);
                
                // Marcar o evento como processado no Redis
                await (await clientRedis).set(redisKey, '1', {EX: EXPIRATION_SECONDS});
                
                console.log(`Evento processado com sucesso: ${eventType} para campanha ${campaignId}`);
                newEventsCount++;
            } catch (error) {
                console.error('Erro ao processar evento:', error);
                errorEventsCount++;
            }
        }
        // Log de resumo do processamento
        console.log(`Processamento concluído: ${newEventsCount} novos eventos, ${duplicateEventsCount} duplicados, ${errorEventsCount} erros`);
    }
}