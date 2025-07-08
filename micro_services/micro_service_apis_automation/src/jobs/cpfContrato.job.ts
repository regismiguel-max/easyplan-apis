import { cpfContratoQueue } from "../queues/cpfContrato.queue";
import { logComAlerta } from "../utils/logComAlerta.util";

export async function adicionarCpfContratoJob(cpfs: string[]) {
    if (!Array.isArray(cpfs) || cpfs.length === 0) {
        const msg = "❌ Nenhum CPF válido recebido para enfileirar.";
        await logComAlerta.erro("Enfileirar CPF-Contrato", msg);
        throw new Error(msg);
    }

    await cpfContratoQueue.add("consulta_manual_cpfs", { cpfs }, {
        removeOnComplete: true,
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 3000,
        },
    });
}
