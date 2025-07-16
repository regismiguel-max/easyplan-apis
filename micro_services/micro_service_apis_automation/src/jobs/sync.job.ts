import { syncQueue, SyncJobType } from "../queues/sync.queue";

interface JobOptions {
    tipo: SyncJobType;
    delayMs?: number; // Se quiser agendar para depois
}

/**
 * Adiciona um job à fila de sincronização.
 * @param tipo Tipo do job (propostas, contratos, beneficiarios, completo)
 * @param delayMs Tempo em milissegundos para adiar o job (opcional)
 */
export async function adicionarSyncJob({ tipo, delayMs = 0 }: JobOptions): Promise<void> {
    await syncQueue.add(tipo, {}, {
        delay: delayMs,
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 3000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    });
}
