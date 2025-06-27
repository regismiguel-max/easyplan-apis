import { Worker } from "bullmq"
import { createClient } from "redis"
import { RedisHelper } from "./redis-helper";
import { redisConfig } from "../../config/redis-config";
import { redisClient } from "../../database/config/redis.config";
import CampaignSenderFactory from "../../../domain/factories/campaign-sender-factory";
import CampaignRepository from "../../repositories/campaign.repository";
import { CampaignStatus } from "../../../domain/enums/campaign-status.enum";
import { SendCampaignDTO } from "../../../domain/entities/interfaces/send-data.interface";
import KaulizHelper from "./kauliz-status.helper";
import StatisticsWhatsCampaignRepository from "../../repositories/statistics-whats-campaign.repository";
import { Payload } from "../../providers/whatsapp-campaign-sender.provider";

import { createLogger } from '../../../utils/logs/logger';
const log = createLogger('worker', 'campaign_worker', 'Campaign_Worker');

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
    const { baseData, chunkIndex, recipientGroup } = job.data as SendCampaignDTO;
    const campaignId = baseData.id;
    const lockJobId = job.id?.toString() || `job_${Date.now()}`;
    const recipientCount = recipientGroup.length;
    let isFailedAfterSentCampaign: boolean = false;

    const startMsg = `🚀 WORKER: Iniciando job ${lockJobId} - Campanha ${campaignId} - Chunk ${chunkIndex} - ${recipientCount} emails`;
    const timestampMsg = `📊 WORKER: Timestamp: ${new Date().toISOString()}`;
    console.log(startMsg);
    console.log(timestampMsg);
    log(startMsg);
    log(timestampMsg);

    // Chave única para este chunk específico
    const statusChunkKey = `campaign:${campaignId}:chunk:${chunkIndex}:status`;
    const processChunkLockKey = `campaign:${campaignId}:chunk:${chunkIndex}:processinglock`;
    console.log('Vamos vê o resultado da criação das chaves lock e status', processChunkLockKey, statusChunkKey);
    log(`Chaves lock/status: ${processChunkLockKey} | ${statusChunkKey}`);

    try {
      // Verificação atômica se já está sendo processado usando helper
      console.log('Enviar a chave, valor e tempo para criação da chave');
      log('Tentando adquirir lock do Redis para processamento');
      const isProcessingLock = await redisHelper.acquireLock(processChunkLockKey, lockJobId, 300);
      console.log('Recebido do redisHelp de lock: ', isProcessingLock);
      log(`Resultado do acquireLock: ${isProcessingLock}`);

      if (isProcessingLock === undefined || isProcessingLock === null) throw new Error("Falha ao tentar adquirir o lock no Redis");

      // Se for true é por que não existia e foi criado. Se for false é porque já existia e não foi criado
      if (!isProcessingLock) {
        const currentProcessor = await redisClient.get(processChunkLockKey);

        const warningMsg = `⚠️ WORKER: Chunk ${chunkIndex} já está sendo processado pelo job ${currentProcessor}`;
        console.log(warningMsg);
        log(warningMsg);

        return { skipped: true, reason: "Already processing" }
      }


      // Verificar status atual
      const currentStatus = await redisClient.get(statusChunkKey);

      if (currentStatus === "SENT") {
        const sentMsg = `✅ WORKER: Chunk ${chunkIndex} já foi enviado anteriormente`;
        console.log(sentMsg);
        log(sentMsg);

        await redisHelper.releaseLock(processChunkLockKey);

        return { skipped: true, reason: "Already sent" }
      }

      // Marcar status do chunk como processando
      await redisClient.set(statusChunkKey, "PROCESSING");

      const sender = CampaignSenderFactory.getSender(job.data.channel);
      const sendingMsg = `📧 WORKER: Enviando ${recipientCount} emails para campanha ${campaignId}, chunk ${chunkIndex}...`;
      console.log(sendingMsg);
      log(sendingMsg);

      type senderResult = {
        success: boolean,
        typeCampaign: string,
        idsStatus?: Payload[],
        messageId?: string,
        statusCode: number,
        campaignSents: number,
      }

      const result: senderResult = await sender.senderCampaing(job.data);

      // Marcar como enviado
      await redisClient.set(statusChunkKey, "SENT");
      console.log('A', result);

      // Salvar detalhes do envio usando helper
      const detailsKey = `campaign:${campaignId}:chunk:${chunkIndex}:details`;
      await redisHelper.hSetObject(detailsKey, {
        status: "SENT",
        typeCampaign: result.typeCampaign,
        campaignSents: result.campaignSents.toString(),
        messageId: result.messageId || "",
        timestamp: new Date().toISOString(),
        jobId: lockJobId,
      });

      console.log('B');

      // if(baseData.typeCampaign === 'whatsapp' && result.idsStatus){
      //   console.log('C');
      //   const statusRetorno = await KaulizHelper.getStatus(result.idsStatus);

      //   const swcr = new StatisticsWhatsCampaignRepository();
      //   console.log('status retorno: ', statusRetorno);

      //   const updateResponse = await swcr.update(statusRetorno, campaignId);

      //   const repository = new CampaignRepository();

      //   updateResponse.includes('sucesso') ? await repository.updateStatus(campaignId, CampaignStatus.SENT) : '';
      // }

      // Verificar se todos os chunks foram processados
      if (result.idsStatus) {
        console.log('Tem id de mensagem para ser persistido');
        log('Persistindo payload de mensagens WhatsApp...');
        await checkCampaignStatus(campaignId, result.idsStatus, true, chunkIndex);
      } else {
        await checkCampaignStatus(campaignId);
      }

      const successMsg = `✅ WORKER: Chunk ${chunkIndex} da campanha ${campaignId} enviado com sucesso`;
      const summaryMsg = `📊 WORKER: Emails enviados: ${result.campaignSents}, Message ID: ${result.messageId}`;
      console.log(successMsg);
      console.log(summaryMsg);
      log(successMsg);
      log(summaryMsg);
      // Limpar chave de processamento
      await redisHelper.releaseLock(processChunkLockKey);

      return {
        success: false,
        campaignSent: result.campaignSents,
        messageId: result.messageId,
        chunkIndex,
      }
    } catch (error: any) {
      // Limpar chave de processamento em caso de erro
      await redisHelper.releaseLock(processChunkLockKey)
      await redisClient.set(statusChunkKey, "FAILED")

      const errorMsg = `❌ WORKER: Erro no job ${lockJobId}: ${error.message}`;
      console.error(errorMsg);
      log(errorMsg);

      // Log detalhado do erro
      const errorDetails = `📋 WORKER: Detalhes do erro: ${JSON.stringify({
        campaignId,
        chunkIndex,
        recipientCount,
        errorType: error.constructor.name,
        errorCode: error.code,
        timestamp: new Date().toISOString(),
      })}`;
      console.error(errorDetails);
      log(errorDetails);

      throw error
    }
  },
  {
    connection: redisConfig,
    concurrency: 1,
  },
)

// Função para verificar status da campanha
async function checkCampaignStatus(campaignId: string | number, whatsPayloads?: Payload[], whatsappCampaign?: boolean, chunkIndex?: number) {
  try {
    const campaignInfo = await redisClient.hGetAll(`campaign:${campaignId}:info`);

    const totalChunks = Number.parseInt(campaignInfo.totalChunks || "0");

    if (totalChunks === 0) return;

    let sentChunks = 0;
    let failedChunks = 0;

    for (let i = 1; i <= totalChunks; i++) {
      const status = await redisClient.get(`campaign:${campaignId}:chunk:${i}:status`)
      if (status === "SENT") sentChunks++
      else if (status === "FAILED") failedChunks++
    }

    console.log(`📊 STATUS: Campanha ${campaignId} - ${sentChunks}/${totalChunks} chunks enviados, ${failedChunks} falharam`);

    const repository = new CampaignRepository();

    campaignId = Number(campaignId);

    let campaignSent: boolean = false;

    if (sentChunks === totalChunks) {
      await repository.updateStatus(campaignId, CampaignStatus.SENT);
      console.log(`✅ Campanha ${campaignId} marcada como SENT.`);
      log(`✅ Campanha ${campaignId} marcada como SENT.`);
      campaignSent = true;
    } else if (sentChunks + failedChunks === totalChunks) {
      if (failedChunks === totalChunks) {
        await repository.updateStatus(campaignId, CampaignStatus.FAILED);
        throw new Error('Falha total no disparo da campanha');
      }

      await repository.updateStatus(campaignId, CampaignStatus.PARTIALLY_SENT);
      console.log(`⚠️ Campanha ${campaignId} concluída com falhas, verificar logs`);
      log(`⚠️ Campanha ${campaignId} concluída com falhas, verificar logs`);
    } else {
      console.log(`🕒 Campanha ${campaignId} ainda em processamento.`);
      log(`🕒 Campanha ${campaignId} ainda em processamento.`);
    }

    if (whatsappCampaign && whatsPayloads && campaignSent && chunkIndex) {
      console.log('Campanha disparada com sucesso, vamos criar a tabela para os status das mensagens');
      log('Persistindo status de mensagens WhatsApp...');

      const repository = new StatisticsWhatsCampaignRepository();

      for (const payload of whatsPayloads) {
        console.log('payload para criar status da mensagem: ', payload);

        payload.chunkIndex = chunkIndex;
        payload.campaignId = campaignId;

        await repository.createMessageStatus(payload);

        console.log('Status da mensagem criado com sucesso');

      }
    }
  } catch (error) {
    console.error("Erro ao verificar status da campanha:", error)
    log(`Erro ao verificar status da campanha: ${error}`);
    throw new Error('Error após campanha enviada')
  }
}

console.log("✅ Worker de campanhas melhorado iniciado!")
log("✅ Worker de campanhas melhorado iniciado!");
