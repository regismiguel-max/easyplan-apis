import { SyncLogModel } from "../models";
import logger from "../config/logger.config";

interface SyncLogOptions {
    tipo: "propostas" | "contratos" | "beneficiarios" | "completo";
    status: "sucesso" | "erro";
    detalhes: string;
    inicio: number;
}

export const salvarSyncLog = async ({ tipo, status, detalhes, inicio }: SyncLogOptions) => {
    const duracao = Date.now() - inicio;

    try {
        await SyncLogModel.create({
            tipo,
            status,
            detalhes,
            duracao_ms: duracao,
            executado_em: new Date(),
        });
        logger.info(`📝 Log de sincronização salvo [${tipo}] (${status})`);
    } catch (error: any) {
        logger.error(`❌ Erro ao salvar log de sincronização [${tipo}]: ${error.message}`);
    }
};
