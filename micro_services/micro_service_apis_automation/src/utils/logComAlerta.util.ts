import logger from "../config/logger.config";
import { enviarAlertaEmail, enviarAlertaWhatsApp } from "./notificacao.util";

export const logComAlerta = {
    async sucesso(titulo: string, mensagem: string) {
        logger.info(`✅ ${mensagem}`);
        await enviarAlertaEmail(titulo, mensagem);
        await enviarAlertaWhatsApp(mensagem);
    },

    async erro(titulo: string, mensagem: string, erroOriginal?: any) {
        logger.error(`❌ ${mensagem}`);

        const detalheErro = erroOriginal instanceof Error
            ? erroOriginal.message
            : typeof erroOriginal === "string"
                ? erroOriginal
                : JSON.stringify(erroOriginal);

        const corpo = `${mensagem}\n\nDetalhes: ${detalheErro}`;

        await enviarAlertaEmail(titulo, corpo);
        await enviarAlertaWhatsApp(corpo);
    }
};
