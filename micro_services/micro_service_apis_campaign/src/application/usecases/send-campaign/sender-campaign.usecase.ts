import { EmailCampaignFactory } from "../../../domain/factories/entity-email-campaign-factory";
// import SenderCampaignDTO from "../../../presentation/dtos/sender-campaign.dto";
import ISendCampaignUseCase from "../../../domain/contracts/usecase/ISendCampaignUseCase";
import EmailCampaignEntity from "../../../domain/entities/EmailCampaign";
import { addCampaignToQueue } from "../../../infrastructure/queue/jobs/campaign.job";
import EmailCampaignRepository from "../../../infrastructure/repositories/email-campaign.repository";
import EmailTemplateRepository from "../../../infrastructure/repositories/email-template.repository";
import path from 'path';
import * as fs from 'fs';
import CRUDEmailCampaignDTO from "../../../presentation/dtos/email-campaign/input/crud-email-campaign.dto";
import EmailTemplate from "../../../domain/entities/interfaces/email-campaign/email-template.interface";
import FullEmailCampaign, { ShortFullEmailCampaign } from "../../../domain/entities/interfaces/email-campaign/full-email-campaign.interface";
import SendEmailDTO, { BaseDataToSend } from "../../../domain/entities/interfaces/email-campaign/send-data.interface";
import RecipientGroup from "../../../domain/entities/interfaces/email-campaign/recipient-group.interface";
import { EmailCampaignStatus } from "../../../domain/types/email-status.types";
import StatisticsEmailCampaignRepository from "../../../infrastructure/repositories/statistics-email-campaign.repository";
import { campaignQueue } from "../../../infrastructure/queue/queue";
import { redisClient } from "../../../infrastructure/database/config/redis.config";
import { createHash } from "crypto";

export default class SendCampaignUseCase implements ISendCampaignUseCase {
    constructor(
        private emailTemplateRepository: EmailTemplateRepository,
        private emailCampaignRepository: EmailCampaignRepository,
        private statisticsRepository: StatisticsEmailCampaignRepository
    ) {}

    async execute(dto: any): Promise<void | string> {
    const emailCampaignEntity = await EmailCampaignFactory.createNew(dto)

    if (!emailCampaignEntity) throw new Error("Erro ao instanciar a entidade EmailCampaign")
    if (await !emailCampaignEntity.canBeDispatched()) throw new Error("Campanha não atende aos requisitos de disparo")

    const campaignId = emailCampaignEntity.emailCampaignBaseInformations.id
    const templateId = emailCampaignEntity.emailCampaignBaseInformations.emailTemplateId

    if (!templateId) throw new Error("Campanha sem id do template")
    if (!campaignId) throw new Error("Nenhum ID de campanha passado")

    // Verificar se a campanha já está sendo processada
    const campaignLockKey = `campaign:${campaignId}:lock`
    const isLocked = await redisClient.get(campaignLockKey)

    if (isLocked) {
      throw new Error(`Campanha ${campaignId} já está sendo processada`)
    }

    // Criar lock para a campanha
    await redisClient.setEx(campaignLockKey, 3600, "PROCESSING") // Lock por 1 hora

    try {
      const emailCampaign = await this.emailCampaignRepository.findById(campaignId)
      const baseData = {
        id: campaignId,
        campaignName: emailCampaign.emailCampaign.campaignName,
        subject: emailCampaign.emailCampaign.subject,
        status: emailCampaign.emailCampaign.status,
      }

      const templateDB = await this.emailTemplateRepository.findById(templateId)
      const templateHTML = fs.readFileSync(templateDB.absolutePath, "utf-8")

      const { recipientsGroup, count } = await this.emailCampaignRepository.getRecipientGroupById(campaignId)

      // Remover duplicatas logo no início
      const recipientsGroupEmails: string[] = [...new Set(recipientsGroup.map((rg: any) => rg.email_principal))]

      console.log(`📊 Total de destinatários únicos: ${recipientsGroupEmails.length}`)

      const chunkSize = 500
      const chunks = await this.splitIntoChunks(recipientsGroupEmails, chunkSize)
      const totalChunks = chunks.length

      // Salvar informações da campanha no Redis
      const campaignKey = `campaign:${campaignId}:info`
      await redisClient.hSet(campaignKey, {
        totalChunks: totalChunks.toString(),
        totalRecipients: recipientsGroupEmails.length.toString(),
        status: "QUEUING",
        startTime: new Date().toISOString(),
      })

      console.log(
        `📦 Dividindo ${recipientsGroupEmails.length} emails em ${totalChunks} chunks de até ${chunkSize} emails`,
      )

      for (let i = 0; i < chunks.length; i++) {
        const chunkEmails = chunks[i]

        // Criar hash único para este chunk específico
        const chunkHash = this.createChunkHash(campaignId.toString(), chunkEmails, i)
        const jobId = `${campaignId}:${chunkHash}:${chunkEmails.length}`

        console.log(`📧 Processando chunk ${i + 1}/${totalChunks} com ${chunkEmails.length} emails`)
        console.log(`🔑 Job ID: ${jobId}`)

        const sendData = {
          baseData,
          template: templateHTML,
          recipientGroup: chunkEmails,
          channel: dto.channel ?? null,
          recipientsGroupCount: chunkEmails.length,
          chunkIndex: i + 1,
          totalChunks,
        }

        // Verificação mais robusta de duplicatas
        const jobExists = await this.checkJobExists(jobId)
        if (jobExists) {
          console.log(`⚠️ Job ${jobId} já existe. Pulando...`)
          continue
        }

        // Adicionar à fila com ID único
        await this.addCampaignToQueueSafe(sendData, jobId)

        console.log(`✅ Chunk ${i + 1}/${totalChunks} adicionado à fila com sucesso`)

        // Delay entre chunks para evitar sobrecarga
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }

      await this.statisticsRepository.create(recipientsGroupEmails.length, campaignId)
      await this.emailCampaignRepository.updateStatus(campaignId, EmailCampaignStatus.QUEUED);

      // Remover lock
      await redisClient.del(campaignLockKey)

      return "A campanha foi colocada na fila com sucesso"
    } catch (error) {
      // Remover lock em caso de erro
      await redisClient.del(campaignLockKey)
      throw error
    }
  }

  private createChunkHash(campaignId: string, emails: string[], chunkIndex: number): string {
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

  private async addCampaignToQueueSafe(data: any, jobId: string) {
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

  private async splitIntoChunks(recipientsEmails: string[], chunkSize: number): Promise<string[][]> {
    const results: string[][] = []
    const emailsCopy = [...recipientsEmails]

    for (let i = 0; i < emailsCopy.length; i += chunkSize) {
      results.push(emailsCopy.slice(i, i + chunkSize))
    }

    console.log(`📦 Criados ${results.length} chunks de emails`)
    return results
  }
}


// const sendEmailData: SendEmailDTO = {
//     baseData,
//     template: templateHTML,
//     recipientGroup: recipientsGroupEmails,
//     channel: dto.channel ?? null,
//     recipientsGroupCount
// }

// console.log('Dados finais para disparo: ', sendEmailData);

// // Enviar para fila
// const resultQueue = await addCampaignToQueue(sendEmailData); // apenas adiciona na fila e delega o processamento para o worker

// // Valida o retorno
// if (!resultQueue.id) {
//     console.log('Acho que deu erro');
//     return
// }
// Retorna
// private async splitIntoChunks(recipientsEmails: string[], chunkSize: number) {
//     const results = [];
//     while (recipientsEmails.length) {
//         results.push(recipientsEmails.splice(0, chunkSize));
//     }
//     return results;
// }

// console.log(`📊 Total de destinatários: ${recipientsGroupCount}`);
//         console.log(`📦 Dividindo em ${chunks.length} lotes de até ${chunkSize} emails cada`);
    
//         // Verificar se a soma dos chunks é igual ao total
//         const totalInChunks = chunks.reduce( (total, chunk) => total + chunk.length, 0);
//         console.log(`🔍 Verificação: ${totalInChunks} emails nos chunks (deve ser igual a ${recipientsGroupCount})`);
    
//         if (totalInChunks !== recipientsGroupCount) throw new Error( `Erro na divisão dos emails: ${totalInChunks} nos chunks != ${recipientsGroupCount} total` );


//         console.log(`🚀 Iniciando processamento de ${chunks.length} lotes para campanha ${campaignId}`);
    
//         // Verificar jobs já na fila antes de adicionar novos
//         const waitingJobs = await campaignQueue.getWaiting();
//         const processingJobs = await campaignQueue.getActive();
//         console.log(`📊 FILA: ${waitingJobs.length} jobs aguardando, ${processingJobs.length} jobs em processamento`);