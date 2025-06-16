import CampaignFactory from "../../../domain/factories/campaign-entity-factory";
// import SenderCampaignDTO from "../../../presentation/dtos/sender-campaign.dto";
import ISendCampaignUseCase from "../../../domain/contracts/usecase/ISendCampaignUseCase";
import CampaignRepository from "../../../infrastructure/repositories/campaign.repository";
import TemplateRepository from "../../../infrastructure/repositories/template.repository";
import * as fs from 'fs';
import  ShortFullEmailCampaign  from "../../../domain/entities/interfaces/email-campaign/full-email-campaign.interface";
import { SendCampaignDTO, BaseDataToSend, SendEmailCampaignDTO, SendWhatsappCampaignDTO } from "../../../domain/entities/interfaces/send-data.interface";
import { CampaignStatus } from "../../../domain/enums/campaign-status.enum";
import StatisticsEmailCampaignRepository from "../../../infrastructure/repositories/statistics-email-campaign.repository";
import { campaignQueue } from "../../../infrastructure/queue/queue";
import { redisClient } from "../../../infrastructure/database/config/redis.config";
import { createHash } from "crypto";
import RecipientGroupRepository from "../../../infrastructure/repositories/recipient-group.repository";
import { htmlToText } from 'html-to-text';
import StatisticsWhatsCampaignRepository from "../../../infrastructure/repositories/statistics-whats-campaign.repository";

export default class SendCampaignUseCase implements ISendCampaignUseCase {
    constructor(
        private templateRepository: TemplateRepository,
        private campaignRepository: CampaignRepository,
        private statisticsRepository: StatisticsEmailCampaignRepository,
        private whatsStatisticsRepository: StatisticsWhatsCampaignRepository,
        private recipientGroupRepository: RecipientGroupRepository
    ) {}

    async execute(dto: any): Promise<void | string> {
      //------------------------------------------------------------ 1° Passo instancia classe de dominio e aplicar safeguards --------------------------------------------------------------
      const campaignEntity = await CampaignFactory.createNew(dto);

      if (!campaignEntity) throw new Error("Erro ao instanciar a entidade campaign")
      if (await !campaignEntity.canBeDispatched()) throw new Error("Campanha não atende aos requisitos de disparo")

      const campaignId = campaignEntity.baseInformations.id
      const templateId = campaignEntity.baseInformations.templateId

      if (!templateId) throw new Error("Campanha sem id do template")
      if (!campaignId) throw new Error("Nenhum ID de campanha passado")

      //-------------------------------------------------------------- 2° Passo criar chave Lock para os processos internos dessa campanha ---------------------------------------------------
      // Verificar se a campanha já está sendo processada
      const campaignLockKey = `campaign:${campaignId}:lock`
      const isLocked = await redisClient.get(campaignLockKey)

      if (isLocked) {
        throw new Error(`Campanha ${campaignId} já está sendo processada`)
      }

      // Criar lock para a campanha
      await redisClient.setEx(campaignLockKey, 3600, "PROCESSING") // Lock por 1 hora

      try {
        //------------------------------------------------------------ 3° Passo buscar a campanha em questão no banco de dados -----------------------------------------------------------------
        const campaign: ShortFullEmailCampaign = await this.campaignRepository.findById(campaignId);
        
        //------------------------------------------------------------ 4° Passo buscar template da campanha a ser disparada ---------------------------------------------------------------------
        console.log('Antes de buscar o template');
        const templateDB = await this.templateRepository.findById(templateId);
        console.log('Depois: ', templateDB);
        const templateHTML = fs.readFileSync(templateDB.templateContent, "utf-8");
        // Caso seja campanha de whatsapp transformamos o templateHTML em texto puro
        let plainText: string | undefined;
        if(campaign.campaign.typeCampaign === 'whatsapp') {
          plainText = htmlToText(templateHTML, {
            wordwrap: false,
            selectors: [
              {selector: 'a', options:{ hideLinkHrefIfSameAsText: true }}
            ]
          });
          
          console.log('Veja o html traduzido em Texto: ', plainText);
        }
        
        
        //------------------------------------------------------------ 5° Passo buscar grupo destinatário da campanha ----------------------------------------------------------------------------
        console.log('Antes de buscar o grupo destinatário');
        const { recipientsGroup, count } = await this.recipientGroupRepository.getRecipientGroupById(campaignId);
        
        // Remover duplicatas logo no início
        const recipientsGroupEmails: string[] = [...new Set(recipientsGroup.map((rg: any) => rg.email_principal))];
        
        console.log(`📊 Total de destinatários únicos: ${recipientsGroupEmails.length}`);
        let clientNumbers: number[] = [];
        //------------------------------------------------------------ 6° Passo Criar lotes do grupo destinatário para facilitar o processamento -------------------------------------------------
        const chunkSize = 500;
        let chunks: (string | number)[][] = [];
        if(campaign.campaign.typeCampaign === 'whatsapp'){
          // clientNumbers = [...new Set(recipientsGroup.map((rg: any) => {
          //   const ddd = rg.ddd_celular;
          //   const celular = rg.celular;

          //   const number = ddd + celular;
          //   return number;
          // }))];

          clientNumbers = [
            84994969191,
            54992389702,
            61993598991,
            899929220040
          ]
          chunks = await this.splitIntoChunks(clientNumbers, chunkSize);

        } else if(campaign.campaign.typeCampaign === 'email') {
          chunks = await this.splitIntoChunks(recipientsGroupEmails, chunkSize);
        }

        const totalChunks = chunks.length;
        
        //------------------------------------------------------------ 7° Passo criar chave Informações de disparo da campanha --------------------------------------------------------------------
        // Salvar informações da campanha no Redis
        const campaignKey = `campaign:${campaignId}:info`
        await redisClient.hSet(campaignKey, {
          totalChunks: totalChunks.toString(),
          totalRecipients: recipientsGroupEmails.length.toString(),
          status: "QUEUING",
          startTime: new Date().toISOString(),
        })
        
        console.log(`📦 Dividindo ${recipientsGroupEmails.length} emails em ${totalChunks} chunks de até ${chunkSize} emails`,);
        
        //------------------------------------------------------------ 8° Passo Começar a montar o DTO de disparo - Informações Base ---------------------------------------------------------------------
        const baseData: BaseDataToSend = {
          id: campaignId,
          campaignName: campaign.campaign.campaignName,
          subject: campaign.campaign.subject,
          status: campaign.campaign.status,
          typeCampaign: campaign.campaign.typeCampaign
        }
        
        
        
        //------------------------------------------------------------ 9° Passo Finalizar o DTO de disparo por lote de grupo destinatário ---------------------------------------------------------------------
        for (let i = 0; i < chunks.length; i++) {
          const chunkContacts = chunks[i];

          // Criar hash único para este lote específico
          const chunkHash = this.createChunkHash(campaignId.toString(), chunkContacts, i);
          const jobId = `${campaignId}:${chunkHash}:${chunkContacts.length}`;

          console.log(`📧 Processando chunk ${i + 1}/${totalChunks} com ${chunkContacts.length} contatos`);
          console.log(`🔑 Job ID: ${jobId}`);

          let sendData: SendCampaignDTO;

          if (baseData.typeCampaign === 'email'){
            sendData = {
              baseData,
              template: templateHTML,
              recipientGroup: chunkContacts as string[],
              channel: dto.channel ?? null,
              recipientsGroupCount: chunkContacts.length,
              chunkIndex: i + 1,
              totalChunks,
            } as SendEmailCampaignDTO;
          } else if(baseData.typeCampaign === 'whatsapp' && plainText) {
            sendData = {
              baseData,
              template: plainText,
              recipientGroup: chunkContacts as number[],
              channel: dto.channel ?? null,
              recipientsGroupCount: chunkContacts.length,
              chunkIndex: i + 1,
              totalChunks,
            } as SendWhatsappCampaignDTO;
          }  else {
            throw new Error('❌ Tipo de campanha inválido ou template WhatsApp ausente!');
          }

          // Verificação mais robusta de duplicatas
          const jobExists = await this.checkJobExists(jobId)
          if (jobExists) {
            console.log(`⚠️ Job ${jobId} já existe. Pulando...`)
            continue
          }

          //------------------------------------------------------------ 10° Passo DTO de disparo finalizado - ADICIONAR NA FILA PARA DISPARO---------------------------------------------------------------------
          // Adicionar à fila com ID único
          await this.addCampaignToQueueSafe(sendData, jobId)

          console.log(`✅ Chunk ${i + 1}/${totalChunks} adicionado à fila com sucesso`)

          // Delay entre chunks para evitar sobrecarga
          if (i < chunks.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }
        }

        //--------------------------------------------------------------- 11° Passo criar estatísticas da Campanha e atualizar o status da campanha em questão ------------------------------------------------------
        if(baseData.typeCampaign === 'email') {
          await this.statisticsRepository.create(recipientsGroupEmails.length, campaignId)
        } else if(baseData.typeCampaign === 'whatsapp') {
          await this.whatsStatisticsRepository.create(clientNumbers.length, campaignId)
        }
        await this.campaignRepository.updateStatus(campaignId, CampaignStatus.QUEUED);

        // Remover lock
        await redisClient.del(campaignLockKey)

        return "A campanha foi colocada na fila com sucesso"
      } catch (error) {
        // Remover lock em caso de erro
        await redisClient.del(campaignLockKey)
        throw error
      }
  }

  private createChunkHash(campaignId: string, emails: (string | number)[], chunkIndex: number): string {
    const content = `${campaignId}:${chunkIndex}:${emails.sort().join(",")}`
    return createHash("md5").update(content).digest("hex").substring(0, 10)
  }

  private async checkJobExists(jobId: string): Promise<boolean> {
    try {
      // Verificar se o job existe na fila
      const job = await campaignQueue.getJob(jobId)
      if (job) {
        console.log(`🔍 Job ${jobId} encontrado na fila com status: ${await job.getState()}`)
        return true
      }
      return false
    } catch (error) {
      return false
    }
  }

  private async addCampaignToQueueSafe(data: SendCampaignDTO, jobId: string) {
    const job = await campaignQueue.add("sendCampaign", data, {
      priority: 1,
      jobId: jobId,
      removeOnComplete: 10, // Manter apenas os últimos 10 jobs completos
      removeOnFail: 50, // Manter os últimos 50 jobs falhados para debug
      attempts: 3, // Máximo 3 tentativas
      backoff: {
        type: "exponential",
        delay: 5000, // Delay inicial de 5 segundos
      },
    })

    console.log(`✅ Job ${job.id} criado com sucesso`)
    return job
  }

  private async splitIntoChunks(recipientsEmails: (string | number)[], chunkSize: number): Promise<(string | number)[][]> {
    const results: (string | number)[][] = []
    const emailsCopy = [...recipientsEmails]

    for (let i = 0; i < emailsCopy.length; i += chunkSize) {
      results.push(emailsCopy.slice(i, i + chunkSize))
    }

    console.log(`📦 Criados ${results.length} chunks de emails`)
    return results
  }
}
