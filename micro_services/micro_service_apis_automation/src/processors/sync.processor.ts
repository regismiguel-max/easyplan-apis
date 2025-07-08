import { Job } from "bullmq";
import { buscarEArmazenarPropostas } from "../jobs/buscarPropostas.job";
import { VerificarContratoService } from "../services/verificarContrato.service";
import { AtualizarBeneficiariosService } from "../services/atualizarBeneficiarios.service";
import { salvarSyncLog } from "../utils/synclog.util";
import { logComAlerta } from "../utils/logComAlerta.util";
import logger from "../config/logger.config";

const tiposValidos = ["propostas", "contratos", "beneficiarios", "completo"] as const;
type TipoJob = (typeof tiposValidos)[number];

export async function syncProcessor(job: Job) {
    const inicio = Date.now();
    const tipo = job.name as TipoJob;
    let mensagemFinal = "";

    logger.info(`📥 Job recebido: ${tipo} | ID: ${job.id} | Dados: ${JSON.stringify(job.data)}`);

    await logComAlerta.sucesso(
        `🟢 Iniciando Job BullMQ: ${tipo}`,
        `Job '${tipo}' iniciado em ${new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
        })}`
    );

    try {
        if (!tiposValidos.includes(tipo)) {
            throw new Error(`Tipo de job inválido: '${tipo}'`);
        }

        switch (tipo) {
            case "propostas": {
                const resultado = await buscarEArmazenarPropostas();
                mensagemFinal = `📄 Propostas processadas com sucesso:\n - Novas: ${resultado.novas}\n - Atualizadas: ${resultado.atualizadas}`;
                break;
            }

            case "contratos": {
                const resultado = await VerificarContratoService.verificarContratos();
                mensagemFinal = `🔍 Verificação de contratos concluída:\n${resultado?.resumo || "Sem detalhes."}`;
                break;
            }

            case "beneficiarios": {
                const resultado = await AtualizarBeneficiariosService.atualizarBeneficiarios();
                mensagemFinal = `♻️ Atualização de beneficiários finalizada:\n${resultado?.resumo || "Sem detalhes."}`;
                break;
            }

            case "completo": {
                const resultadoPropostas = await buscarEArmazenarPropostas();
                const resultadoContratos = await VerificarContratoService.verificarContratos();
                const resultadoBeneficiarios = await AtualizarBeneficiariosService.atualizarBeneficiarios();

                mensagemFinal = `✅ Execução completa realizada com sucesso:
📄 Propostas:
 - Novas: ${resultadoPropostas.novas}
 - Atualizadas: ${resultadoPropostas.atualizadas}

🔍 Contratos:
${resultadoContratos?.resumo || "Sem retorno."}

♻️ Beneficiários:
${resultadoBeneficiarios?.resumo || "Sem retorno."}`;
                break;
            }
        }

        await salvarSyncLog({
            tipo,
            status: "sucesso",
            detalhes: mensagemFinal,
            inicio,
        });

        await logComAlerta.sucesso(`✅ Job BullMQ: ${tipo}`, mensagemFinal);
        return { status: "ok", tipo };
    } catch (error: any) {
        const msgErro = `❌ Erro ao executar job '${tipo}': ${error.message}`;
        logger.error(msgErro);
        await salvarSyncLog({
            tipo,
            status: "erro",
            detalhes: msgErro,
            inicio,
        });
        await logComAlerta.erro(`❌ Erro Job BullMQ: ${tipo}`, msgErro, error);
        throw error;
    }
}
