import nodemailer from "nodemailer";
import logger from "../config/logger.config";
import api from "../config/axios.config";

// ENV: WhatsApp
const WHATSAPP_API_KEY = process.env.AUTOMATION_WHATSAPP_API_KEY;
const WHATSAPP_QUEUE_ID = Number(process.env.AUTOMATION_WHATSAPP_QUEUE_ID);
const WHATSAPP_NUMEROS = process.env.AUTOMATION_ALERTA_WHATSAPP_NUMEROS
    ? process.env.AUTOMATION_ALERTA_WHATSAPP_NUMEROS.split(",").map(n => n.trim())
    : [];

// ENV: SMTP
const SMTP_HOST = process.env.AUTOMATION_SMTP_HOST;
const SMTP_PORT = Number(process.env.AUTOMATION_SMTP_PORT) || 587;
const SMTP_USER = process.env.AUTOMATION_SMTP_USER;
const SMTP_PASS = process.env.AUTOMATION_SMTP_PASS;
const DESTINATARIOS_EMAIL = process.env.AUTOMATION_ALERTA_DESTINATARIOS
    ? process.env.AUTOMATION_ALERTA_DESTINATARIOS.split(",").map(e => e.trim())
    : [];

/**
 * Envia um alerta por WhatsApp para todos os números configurados.
 */
export const enviarAlertaWhatsApp = async (mensagem: string) => {
    if (!WHATSAPP_API_KEY || !WHATSAPP_QUEUE_ID || WHATSAPP_NUMEROS.length === 0) {
        logger.warn("⚠️ Configuração de WhatsApp incompleta. Alerta não enviado.");
        return;
    }

    for (const numero of WHATSAPP_NUMEROS) {
        const payload = {
            queueId: WHATSAPP_QUEUE_ID,
            apiKey: WHATSAPP_API_KEY,
            number: numero,
            country: "+55",
            text: mensagem,
        };

        try {
            await api.axiosWhatsapp.post("", payload);
            logger.info(`📲 Alerta enviado por WhatsApp para ${numero}`);
        } catch (error: any) {
            logger.error(`❌ Falha ao enviar alerta WhatsApp para ${numero}: ${error.message}`);
        }
    }
};

/**
 * Envia um alerta por e-mail para todos os destinatários configurados.
 */
export const enviarAlertaEmail = async (assunto: string, mensagem: string) => {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || DESTINATARIOS_EMAIL.length === 0) {
        logger.warn("⚠️ Configuração SMTP incompleta. Alerta de e-mail não enviado.");
        return;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });

        await transporter.sendMail({
            from: `"EasyPlan Notificações" <${SMTP_USER}>`,
            to: DESTINATARIOS_EMAIL,
            subject: assunto,
            text: mensagem,
        });

        logger.info(`📬 Alerta de e-mail enviado para: ${DESTINATARIOS_EMAIL.join(", ")}`);
    } catch (error: any) {
        logger.error(`❌ Falha ao enviar alerta por e-mail: ${error.message}`);
    }
};

/**
 * Dispara um alerta crítico por e-mail e WhatsApp.
 */
export const notificarErroCritico = async (titulo: string, mensagem: string) => {
    await enviarAlertaEmail(titulo, mensagem);
    await enviarAlertaWhatsApp(mensagem);
};
