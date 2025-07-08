import logger from "../config/logger.config";

export const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Executa uma função assíncrona com tentativas, atraso entre chamadas e backoff opcional.
 * @param fn Função a ser executada
 * @param options Configurações de controle
 */
export const withRateLimit = async <T>(
    fn: () => Promise<T>,
    options?: {
        delayMs?: number;        // Delay entre execuções (default: 300ms)
        retries?: number;        // Número de tentativas em caso de falha (default: 3)
        backoffFactor?: number;  // Fator de crescimento do delay a cada tentativa (default: 2)
    }
): Promise<T> => {
    const delayMs = options?.delayMs ?? 300;
    const retries = options?.retries ?? 3;
    const backoffFactor = options?.backoffFactor ?? 2;

    let attempt = 0;

    while (true) {
        try {
            if (attempt > 0) {
                const backoff = delayMs * Math.pow(backoffFactor, attempt - 1);
                logger.warn(`⏳ Retry #${attempt} com delay de ${backoff}ms...`);
                await delay(backoff);
            }

            const result = await fn();
            await delay(delayMs); // Pequeno delay entre chamadas bem-sucedidas
            return result;
        } catch (err: any) {
            attempt++;
            if (attempt > retries) {
                logger.error(`❌ Todas as ${retries} tentativas falharam: ${err.message}`);
                throw err;
            }
        }
    }
};
