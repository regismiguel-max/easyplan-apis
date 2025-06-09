import { Worker } from "bullmq"
import { createClient } from "redis"
// import { ImprovedEmailCampaignSender } from "./sender"

// import { redisConfig } from "./config/redis"
import { RedisHelper } from "./redis-helper"
import { redisConfig } from "../../config/redis-config"
import { redisClient } from "../../database/config/redis.config"
import CampaignSenderFactory from "../../../domain/factories/campaign-sender-factory"

// const redisClient = createClient(redisConfig)
const redisHelper = new RedisHelper(redisClient)

// redisClient.on("error", (err) => console.log("Redis Client Error", err))

// redisClient
//   .connect()
//   .then(() => {
//     console.log("Connected to Redis!")
//   })
//   .catch((err) => console.log("Redis connection error: ", err))

const campaignWorker = new Worker(
  "campaignQueue",
  async (job) => {
    const { baseData, chunkIndex, recipientGroup } = job.data
    const campaignId = baseData.id
    const jobId = job.id?.toString() || `job_${Date.now()}`
    const recipientCount = recipientGroup.length

    console.log(
      `🚀 WORKER: Iniciando job ${jobId} - Campanha ${campaignId} - Chunk ${chunkIndex} - ${recipientCount} emails`,
    )
    console.log(`📊 WORKER: Timestamp: ${new Date().toISOString()}`)

    // Chave única para este chunk específico
    const redisKey = `campaign:${campaignId}:chunk:${chunkIndex}:status`
    const processKey = `campaign:${campaignId}:chunk:${chunkIndex}:processing`

    try {
      // Verificação atômica se já está sendo processado usando helper
      const isProcessing = await redisHelper.acquireLock(processKey, jobId, 300)

      if (!isProcessing) {
        const currentProcessor = await redisClient.get(processKey)
        console.log(`⚠️ WORKER: Chunk ${chunkIndex} já está sendo processado pelo job ${currentProcessor}`)
        return { skipped: true, reason: "Already processing" }
      }

      // Verificar status atual
      const currentStatus = await redisClient.get(redisKey)
      if (currentStatus === "SENT") {
        console.log(`✅ WORKER: Chunk ${chunkIndex} já foi enviado anteriormente`)
        await redisHelper.releaseLock(processKey)
        return { skipped: true, reason: "Already sent" }
      }

      // Marcar como processando
      await redisClient.set(redisKey, "PROCESSING")

      const sender =  CampaignSenderFactory.getSender(job.data.channel);

      console.log(`📧 WORKER: Enviando ${recipientCount} emails para campanha ${campaignId}, chunk ${chunkIndex}...`)

      const result = await sender.senderCampaing(job.data)

      // Marcar como enviado
      await redisClient.set(redisKey, "SENT")

      // Salvar detalhes do envio usando helper
      const detailsKey = `campaign:${campaignId}:chunk:${chunkIndex}:details`
      await redisHelper.hSetObject(detailsKey, {
        status: "SENT",
        emailsSent: result.emailsSent.toString(),
        messageId: result.messageId || "",
        timestamp: new Date().toISOString(),
        jobId: jobId,
      })

      // Limpar chave de processamento
      await redisHelper.releaseLock(processKey)

      // Verificar se todos os chunks foram processados
      await checkCampaignStatus(campaignId)

      console.log(`✅ WORKER: Chunk ${chunkIndex} da campanha ${campaignId} enviado com sucesso`)
      console.log(`📊 WORKER: Emails enviados: ${result.emailsSent}, Message ID: ${result.messageId}`)

      return {
        success: true,
        emailsSent: result.emailsSent,
        messageId: result.messageId,
        chunkIndex,
      }
    } catch (error: any) {
      // Limpar chave de processamento em caso de erro
      await redisHelper.releaseLock(processKey)
      await redisClient.set(redisKey, "FAILED")

      console.error(`❌ WORKER: Erro no job ${jobId}:`, error.message)

      // Log detalhado do erro
      console.error(`📋 WORKER: Detalhes do erro:`, {
        campaignId,
        chunkIndex,
        recipientCount,
        errorType: error.constructor.name,
        errorCode: error.code,
        timestamp: new Date().toISOString(),
      })

      throw error
    }
  },
  {
    connection: redisConfig,
    concurrency: 1,
  },
)

// Função para verificar status da campanha
async function checkCampaignStatus(campaignId: string) {
  try {
    const campaignInfo = await redisClient.hGetAll(`campaign:${campaignId}:info`)
    const totalChunks = Number.parseInt(campaignInfo.totalChunks || "0")

    if (totalChunks === 0) return

    let sentChunks = 0
    let failedChunks = 0

    for (let i = 1; i <= totalChunks; i++) {
      const status = await redisClient.get(`campaign:${campaignId}:chunk:${i}:status`)
      if (status === "SENT") sentChunks++
      else if (status === "FAILED") failedChunks++
    }

    console.log(
      `📊 STATUS: Campanha ${campaignId} - ${sentChunks}/${totalChunks} chunks enviados, ${failedChunks} falharam`,
    )

    if (sentChunks === totalChunks) {
      console.log(`🎉 Campanha ${campaignId} concluída com sucesso!`)
    } else if (sentChunks + failedChunks === totalChunks) {
      console.log(`⚠️ Campanha ${campaignId} concluída com falhas`)
    }
  } catch (error) {
    console.error("Erro ao verificar status da campanha:", error)
  }
}

console.log("✅ Worker de campanhas melhorado iniciado!")
