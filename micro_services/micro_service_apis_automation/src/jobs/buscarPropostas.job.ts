import { PropostaService } from "../services/proposta.service";
import logger from "../config/logger.config";

export const buscarEArmazenarPropostas = async (): Promise<{ novas: number; atualizadas: number }> => {
    logger.info("🔄 Iniciando job: Buscar e Armazenar Propostas...");

    try {
        const resultado = await PropostaService.buscarEArmazenarPropostas();

        if (resultado.novas === 0 && resultado.atualizadas === 0) {
            logger.info("✅ Nenhuma proposta retornada da API.");
        } else {
            logger.info(`✅ Job finalizado. ${resultado.novas} novas propostas salvas, ${resultado.atualizadas} atualizadas.`);
        }

        return resultado;
    } catch (error: any) {
        logger.error(`❌ Erro no job buscarEArmazenarPropostas: ${error.message}`);
        return { novas: 0, atualizadas: 0 }; // fallback seguro
    }
};
