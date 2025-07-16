import cron from "node-cron";
import { buscarEArmazenarPropostas } from "../jobs/buscarPropostas.job";
import { VerificarContratoService } from "../services/verificarContrato.service";
import { AtualizarBeneficiariosService } from "../services/atualizarBeneficiarios.service";
import logger from "../config/logger.config";
import { logComAlerta } from "../utils/logComAlerta.util";
import { salvarSyncLog } from "../utils/synclog.util";

export const agendarExecucaoPrincipal = () => {
    cron.schedule("0 2 * * *", async () => {
        const inicio = Date.now();
        const horaInicio = new Date().toLocaleString("pt-BR");
        const resumoExecucao: string[] = [];

        logger.info("🕑 Iniciando execução principal do processo...");

        try {
            // Etapa 1: Buscar e armazenar propostas
            logger.info("➕ Etapa 1: Buscando propostas da Planium...");
            const resultadoPropostas = await buscarEArmazenarPropostas();
            const resumoPropostas = `📄 Propostas processadas:\nNovas: ${resultadoPropostas.novas}\nAtualizadas: ${resultadoPropostas.atualizadas}`;
            logger.info(resumoPropostas);
            resumoExecucao.push(resumoPropostas);

            await new Promise(resolve => setTimeout(resolve, 60000));

            // Etapa 2: Verificar contratos digitais
            logger.info("🔍 Etapa 2: Verificando contratos digitais...");
            await VerificarContratoService.verificarContratos();
            const resumoContratos = "📌 Verificação de contratos concluída.";
            logger.info(resumoContratos);
            resumoExecucao.push(resumoContratos);

            await new Promise(resolve => setTimeout(resolve, 60000));

            // Etapa 3: Atualizar beneficiários
            logger.info("♻️ Etapa 3: Atualizando beneficiários...");
            await AtualizarBeneficiariosService.atualizarBeneficiarios();
            const resumoBeneficiarios = "♻️ Atualização de beneficiários concluída.";
            logger.info(resumoBeneficiarios);
            resumoExecucao.push(resumoBeneficiarios);

            const mensagemFinal = `✅ Execução automática concluída com sucesso às ${new Date().toLocaleString("pt-BR")}.\n\n${resumoExecucao.join("\n\n")}`;

            logger.info("✨ Execução principal concluída com sucesso.");
            await logComAlerta.sucesso("Execução automática concluída", mensagemFinal);
            await salvarSyncLog({
                tipo: "completo",
                status: "sucesso",
                detalhes: mensagemFinal,
                inicio,
            });
        } catch (error: any) {
            const mensagemErro = `❌ Erro durante a execução automática iniciada às ${horaInicio}`;
            logger.error(`${mensagemErro}: ${error.message}`);
            await logComAlerta.erro("Erro na execução automática", mensagemErro, error);
            await salvarSyncLog({
                tipo: "completo",
                status: "erro",
                detalhes: `${mensagemErro}: ${error.message}`,
                inicio,
            });
        }
    });
};
