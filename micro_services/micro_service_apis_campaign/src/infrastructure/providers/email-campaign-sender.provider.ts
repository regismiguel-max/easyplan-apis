import sgMail, { MailDataRequired } from '@sendgrid/mail';
import * as dotenv from 'dotenv';
import ICampaignSenderStrategy from '../../domain/contracts/service/ICampaingSenderStrategy';
import { SendEmailCampaignDTO } from '../../domain/entities/interfaces/send-data.interface';

dotenv.config();
export default class EmailCampaignSender implements ICampaignSenderStrategy {
  private apiKey: string | undefined = process.env.CAMPAIGN_SENDGRID_API_KEY;

  constructor() {
    this.setApiKey()
  }

  public async senderCampaing(data: SendEmailCampaignDTO) {
    const campaignId = data.baseData.id
    const chunkIndex = data.chunkIndex

    console.log(
      `📧 PROVIDER: Iniciando envio para ${data.recipientGroup.length} destinatários da campanha ${campaignId} (Chunk ${chunkIndex})`,
    )

    // Verificação adicional de segurança
    const uniqueEmails = [...new Set(data.recipientGroup as string[])];

    if (uniqueEmails.length !== data.recipientGroup.length) {
      console.warn( `⚠️ PROVIDER: Emails duplicados detectados! ${data.recipientGroup.length} total, ${uniqueEmails.length} únicos` )
      // Use apenas emails únicos para evitar duplicatas
      data.recipientGroup = uniqueEmails;
    }

    // Usar personalizations em vez de múltiplos emails
    const emailData = this.buildEmailWithPersonalizations(data);

    console.log(`📬 PROVIDER: Email construído com ${emailData.personalizations?.length} personalizações`);
    console.log(`🎯 PROVIDER: Destinatários únicos: ${data.recipientGroup.length}`);

    try {
      console.log(`🚀 PROVIDER: Enviando para SendGrid (Campanha ${campaignId}, Chunk ${chunkIndex})...`);

      // Log detalhado antes do envio
      console.log(`📊 PROVIDER: Dados do envio:`, {
        personalizations: emailData.personalizations?.length,
        campaignId,
        chunkIndex,
        timestamp: new Date().toISOString(),
      });

      const [response] = await sgMail.send(emailData);

      console.log(`✅ PROVIDER: Envio concluído para campanha ${campaignId}, chunk ${chunkIndex}`);
      console.log(`📊 PROVIDER: Status SendGrid: ${response?.statusCode}`);
      console.log(`📈 PROVIDER: Headers relevantes:`, {
        "x-message-id": response?.headers["x-message-id"],
        "x-ratelimit-remaining": response?.headers["x-ratelimit-remaining"],
      });

      return {
        success: true,
        typeCampaign: 'email',
        messageId: response?.headers["x-message-id"],
        statusCode: response?.statusCode,
        campaignSents: data.recipientGroup.length,
      }
    } catch (error: any) {
      console.error(`❌ PROVIDER: Erro ao enviar campanha ${campaignId}, chunk ${chunkIndex}:`)
      console.error(`📋 PROVIDER: Tipo do erro: ${error.constructor.name}`)
      console.error(`🔍 PROVIDER: Código: ${error.code || "N/A"}`)
      console.error(`💬 PROVIDER: Mensagem: ${error.message}`)

      if (error.response) {
        console.error(`📊 PROVIDER: Status HTTP: ${error.response.status}`)
        console.error(`📝 PROVIDER: Response Body:`, JSON.stringify(error.response.body, null, 2))
      }

      throw error
    }
  }

  private buildEmailWithPersonalizations(data: SendEmailCampaignDTO): MailDataRequired {
    if(!data.baseData.subject) throw new Error('Campanha de Email sem Subject!');
    if (Array.isArray(data.recipientGroup) && data.recipientGroup.some(item => typeof item !== 'string')) throw new Error('❌ recipientGroup não pode ser um array de números!');

    const dataEnvio = new Date().toISOString()

    console.log(`🔨 PROVIDER: Construindo email com personalizations para ${data.recipientGroup.length} destinatários`)

    // Usar personalizations em vez de múltiplos emails
    const personalizations = data.recipientGroup.map((email: string) => ({
      to: [{ email }],
      custom_args: {
        idCampanha: data.baseData.id,
        nomeCampanha: data.baseData.campaignName,
        idDestinatario: email,
        dataEnvio,
        chunkIndex: data.chunkIndex.toString(),
      },
    }));

    const emailData: MailDataRequired = {
      personalizations,
      from: { email: "noreply@easyplan.com.br" },
      subject: data.baseData.subject,
      content: [
        {
          type: "text/plain",
          value: "Confira sua campanha!",
        },
        {
          type: "text/html",
          value: data.template,
        },
      ],
      // Adicionar tracking settings para melhor monitoramento
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
        subscriptionTracking: { enable: false },
      },
      // Custom args globais para toda a campanha
      customArgs: {
        campaign_id: data.baseData.id,
        chunk_index: data.chunkIndex.toString(),
        total_chunks: data.totalChunks.toString(),
      },
    }

    console.log(`✅ PROVIDER: Email construído com ${personalizations.length} personalizations`)

    return emailData;
  }

  private setApiKey() {
    if (!this.apiKey) {
      console.error("❌ CAMPAIGN_SENDGRID_API_KEY não configurada.");
      throw new Error("API Key do SendGrid não configurada.");
    }
    sgMail.setApiKey(this.apiKey)
  }
}