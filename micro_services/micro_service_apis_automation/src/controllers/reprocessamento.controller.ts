import { Request, Response } from "express";
import { SyncLogModel } from "../models";
import { buscarEArmazenarPropostas } from "../jobs/buscarPropostas.job";
import { VerificarContratoService } from "../services/verificarContrato.service";
import { AtualizarBeneficiariosService } from "../services/atualizarBeneficiarios.service";
import { salvarSyncLog } from "../utils/synclog.util";
import { logComAlerta } from "../utils/logComAlerta.util";

export class ReprocessamentoController {
    static async reprocessarPorId(req: Request, res: Response) {
        const { id } = req.params;
        const inicio = Date.now();

        try {
            const log = await SyncLogModel.findByPk(id);

            if (!log) {
                return res.status(404).json({ error: "Log de sincronização não encontrado." });
            }

            // Bloquear reprocessamento de logs com status sucesso
            if (log.status === "sucesso") {
                return res.status(400).json({ error: "Este log já foi processado com sucesso e não pode ser reprocessado." });
            }

            let msg = "";

            switch (log.tipo) {
                case "propostas":
                    const resultadoPropostas = await buscarEArmazenarPropostas();
                    msg = `Reprocessamento de propostas concluído.\nNovas: ${resultadoPropostas.novas}\nAtualizadas: ${resultadoPropostas.atualizadas}`;
                    break;

                case "contratos":
                    await VerificarContratoService.verificarContratos();
                    msg = `Reprocessamento de contratos concluído.`;
                    break;

                case "beneficiarios":
                    await AtualizarBeneficiariosService.atualizarBeneficiarios();
                    msg = `Reprocessamento de beneficiários concluído.`;
                    break;

                case "completo":
                    const propostas = await buscarEArmazenarPropostas();
                    await VerificarContratoService.verificarContratos();
                    await AtualizarBeneficiariosService.atualizarBeneficiarios();
                    msg = `Reprocessamento completo concluído.\nPropostas - Novas: ${propostas.novas}, Atualizadas: ${propostas.atualizadas}`;
                    break;

                default:
                    return res.status(400).json({ error: "Tipo de log inválido." });
            }

            await salvarSyncLog({ tipo: log.tipo, status: "sucesso", detalhes: msg, inicio });
            await logComAlerta.sucesso(`Reprocessamento: ${log.tipo}`, msg);

            return res.status(200).json({ message: "Reprocessamento concluído.", detalhes: msg });
        } catch (error: any) {
            const msg = `Erro ao reprocessar log: ${error.message}`;
            await salvarSyncLog({ tipo: "completo", status: "erro", detalhes: msg, inicio });
            await logComAlerta.erro("Erro no reprocessamento", msg, error);
            return res.status(500).json({ error: msg });
        }
    }

    static async listarLogs(req: Request, res: Response) {
        try {
            const { page = 1, limit = 20, tipo, status } = req.query;

            const where: any = {};
            if (tipo) where.tipo = tipo;
            if (status) where.status = status;

            const offset = (Number(page) - 1) * Number(limit);

            const { count, rows } = await SyncLogModel.findAndCountAll({
                where,
                order: [["executado_em", "DESC"]],
                limit: Number(limit),
                offset,
            });

            return res.status(200).json({
                total: count,
                pagina: Number(page),
                porPagina: Number(limit),
                logs: rows,
            });
        } catch (error: any) {
            return res.status(500).json({ error: `Erro ao listar logs: ${error.message}` });
        }
    }
}
