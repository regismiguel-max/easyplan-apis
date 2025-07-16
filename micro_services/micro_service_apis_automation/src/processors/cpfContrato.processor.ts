import { Job } from "bullmq";
import logger from "../config/logger.config";
import { ConsultarContratosPorCpfService, ResultadoConsultaCPF } from "../services/consultarContratosPorCpf.service";
import { logComAlerta } from "../utils/logComAlerta.util";

export const cpfContratoProcessor = async (job: Job) => {
  logger.info(`📥 Job CPF-Contrato recebido | ID: ${job.id} | Dados: ${JSON.stringify(job.data)}`);

  try {
    const { cpfs } = job.data;

    if (!Array.isArray(cpfs) || cpfs.length === 0) {
      const msg = "⚠️ Lista de CPFs vazia recebida no job.";
      await logComAlerta.erro("CPF-Contrato: lista vazia", msg);
      return;
    }

    logger.info(`🔄 Iniciando processamento de ${cpfs.length} CPF(s)...`);
    const resultado = await ConsultarContratosPorCpfService.consultar(cpfs);

    // Contabiliza resultados por status
    const contagem = {
      criado: 0,
      atualizado: 0,
      nao_encontrado: 0,
      erro: 0
    };

    for (const item of resultado) {
      contagem[item.status]++;
    }

    const msgResumo =
      `📊 Resumo do Job CPF-Contrato:\n` +
      `- Total de CPFs: ${cpfs.length}\n` +
      `- Criados: ${contagem.criado}\n` +
      `- Atualizados: ${contagem.atualizado}\n` +
      `- Não encontrados: ${contagem.nao_encontrado}\n` +
      `- Erros: ${contagem.erro}`;

    logger.info(msgResumo);
    await logComAlerta.sucesso("CPF-Contrato finalizado", msgResumo);

    return {
      status: "ok",
      quantidade: cpfs.length,
      resumo: contagem,
      resultado
    };
  } catch (error: any) {
    const msgErro = `❌ Erro ao executar job CPF-Contrato: ${error.message}`;
    await logComAlerta.erro("Erro CPF-Contrato", msgErro, error);
    throw error;
  }
};
