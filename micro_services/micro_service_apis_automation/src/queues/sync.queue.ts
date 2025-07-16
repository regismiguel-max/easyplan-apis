import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.config';

/**
 * Fila principal de sincronização.
 */
export const syncQueue = new Queue('sync', {
    connection: redisConnection,
});

/**
 * Enum que representa os tipos de jobs disponíveis na fila de sincronização.
 */
export enum SyncJobType {
    PROPOSTAS = 'propostas',
    CONTRATOS = 'contratos',
    BENEFICIARIOS = 'beneficiarios',
    COMPLETO = 'completo'
}
