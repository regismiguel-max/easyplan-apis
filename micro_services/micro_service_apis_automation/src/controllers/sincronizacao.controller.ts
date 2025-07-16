import { Request, Response } from "express";
import { adicionarSyncJob } from "../jobs/sync.job";
import { SyncJobType } from "../queues/sync.queue";
import { logComAlerta } from "../utils/logComAlerta.util";

export class SincronizacaoController {
    static async buscarPropostas(req: Request, res: Response) {
        try {
            await adicionarSyncJob({ tipo: SyncJobType.PROPOSTAS });

            const msg = "Job de sincronização de propostas adicionado à fila.";
            await logComAlerta.sucesso("Job enfileirado: propostas", msg);

            return res.status(200).json({ message: msg });
        } catch (error: any) {
            const msg = `Erro ao adicionar job de propostas à fila: ${error.message}`;
            await logComAlerta.erro("Erro ao enfileirar propostas", msg, error);
            return res.status(500).json({ error: msg });
        }
    }

    static async verificarContratos(req: Request, res: Response) {
        try {
            await adicionarSyncJob({ tipo: SyncJobType.CONTRATOS });

            const msg = "Job de verificação de contratos adicionado à fila.";
            await logComAlerta.sucesso("Job enfileirado: contratos", msg);

            return res.status(200).json({ message: msg });
        } catch (error: any) {
            const msg = `Erro ao adicionar job de contratos à fila: ${error.message}`;
            await logComAlerta.erro("Erro ao enfileirar contratos", msg, error);
            return res.status(500).json({ error: msg });
        }
    }

    static async atualizarBeneficiarios(req: Request, res: Response) {
        try {
            await adicionarSyncJob({ tipo: SyncJobType.BENEFICIARIOS });

            const msg = "Job de atualização de beneficiários adicionado à fila.";
            await logComAlerta.sucesso("Job enfileirado: beneficiarios", msg);

            return res.status(200).json({ message: msg });
        } catch (error: any) {
            const msg = `Erro ao adicionar job de beneficiários à fila: ${error.message}`;
            await logComAlerta.erro("Erro ao enfileirar beneficiários", msg, error);
            return res.status(500).json({ error: msg });
        }
    }

    static async executarTudo(req: Request, res: Response) {
        try {
            await adicionarSyncJob({ tipo: SyncJobType.COMPLETO });

            const msg = "Job completo de sincronização adicionado à fila.";
            await logComAlerta.sucesso("Job enfileirado: completo", msg);

            return res.status(200).json({ message: msg });
        } catch (error: any) {
            const msg = `Erro ao adicionar job completo à fila: ${error.message}`;
            await logComAlerta.erro("Erro ao enfileirar job completo", msg, error);
            return res.status(500).json({ error: msg });
        }
    }
}





// import { Request, Response } from "express";
// import { buscarEArmazenarPropostas } from "../jobs/buscarPropostas.job";
// import { VerificarContratoService } from "../services/verificarContrato.service";
// import { AtualizarBeneficiariosService } from "../services/atualizarBeneficiarios.service";
// import { logComAlerta } from "../utils/logComAlerta.util";
// import { salvarSyncLog } from "../utils/synclog.util";

// export class SincronizacaoController {
//     static async buscarPropostas(req: Request, res: Response) {
//         const inicio = Date.now();
//         try {
//             const resultado = await buscarEArmazenarPropostas();

//             const msg = `🔄 Propostas processadas com sucesso.\nNovas: ${resultado.novas}\nAtualizadas: ${resultado.atualizadas}`;

//             await logComAlerta.sucesso("Propostas processadas", msg);
//             await salvarSyncLog({ tipo: "propostas", status: "sucesso", detalhes: msg, inicio });

//             return res.status(200).json({
//                 message: "Propostas processadas com sucesso.",
//                 resultado,
//             });
//         } catch (error: any) {
//             const msg = `Erro ao buscar propostas: ${error.message}`;
//             await logComAlerta.erro("Erro ao buscar propostas", msg, error);
//             await salvarSyncLog({ tipo: "propostas", status: "erro", detalhes: msg, inicio });

//             return res.status(500).json({ error: msg });
//         }
//     }

//     static async verificarContratos(req: Request, res: Response) {
//         const inicio = Date.now();
//         try {
//             await VerificarContratoService.verificarContratos();

//             const msg = `🔍 Verificação de contratos concluída com sucesso em ${new Date().toLocaleString("pt-BR")}`;
//             await logComAlerta.sucesso("Verificação de contratos concluída", msg);
//             await salvarSyncLog({ tipo: "contratos", status: "sucesso", detalhes: msg, inicio });

//             return res.status(200).json({ message: "Verificação de contratos concluída." });
//         } catch (error: any) {
//             const msg = `Erro ao verificar contratos: ${error.message}`;
//             await logComAlerta.erro("Erro ao verificar contratos", msg, error);
//             await salvarSyncLog({ tipo: "contratos", status: "erro", detalhes: msg, inicio });

//             return res.status(500).json({ error: msg });
//         }
//     }

//     static async atualizarBeneficiarios(req: Request, res: Response) {
//         const inicio = Date.now();
//         try {
//             await AtualizarBeneficiariosService.atualizarBeneficiarios();

//             const msg = `♻️ Atualização de beneficiários concluída com sucesso em ${new Date().toLocaleString("pt-BR")}`;
//             await logComAlerta.sucesso("Atualização de beneficiários", msg);
//             await salvarSyncLog({ tipo: "beneficiarios", status: "sucesso", detalhes: msg, inicio });

//             return res.status(200).json({ message: "Beneficiários atualizados com sucesso." });
//         } catch (error: any) {
//             const msg = `Erro ao atualizar beneficiários: ${error.message}`;
//             await logComAlerta.erro("Erro ao atualizar beneficiários", msg, error);
//             await salvarSyncLog({ tipo: "beneficiarios", status: "erro", detalhes: msg, inicio });

//             return res.status(500).json({ error: msg });
//         }
//     }

//     static async executarTudo(req: Request, res: Response) {
//         const inicio = Date.now();
//         try {
//             const resultado: {
//                 propostas: { novas: number; atualizadas: number };
//                 contratos: string | null;
//                 beneficiarios: string | null;
//             } = {
//                 propostas: await buscarEArmazenarPropostas(),
//                 contratos: null,
//                 beneficiarios: null
//             };

//             await VerificarContratoService.verificarContratos();
//             resultado.contratos = "Verificação concluída";

//             await AtualizarBeneficiariosService.atualizarBeneficiarios();
//             resultado.beneficiarios = "Atualização concluída";

//             const msg = `🟢 Execução completa realizada com sucesso em ${new Date().toLocaleString("pt-BR")}.\nNovas propostas: ${resultado.propostas.novas}\nAtualizadas: ${resultado.propostas.atualizadas}\nStatus contratos: ${resultado.contratos}\nStatus beneficiários: ${resultado.beneficiarios}`;

//             await logComAlerta.sucesso("Sincronização Manual Concluída", msg);
//             await salvarSyncLog({ tipo: "completo", status: "sucesso", detalhes: msg, inicio });

//             return res.status(200).json({
//                 message: "Execução completa realizada com sucesso.",
//                 resultado
//             });
//         } catch (error: any) {
//             const msg = "❌ Falha ao executar sincronização manual.";
//             await logComAlerta.erro("Erro na Sincronização Manual", msg, error);
//             await salvarSyncLog({ tipo: "completo", status: "erro", detalhes: msg, inicio });

//             return res.status(500).json({
//                 error: `${msg} Detalhes: ${error.message}`
//             });
//         }
//     }
// }
