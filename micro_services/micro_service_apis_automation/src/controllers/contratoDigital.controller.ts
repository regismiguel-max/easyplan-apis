import { Request, Response } from "express";
import { adicionarCpfContratoJob } from "../jobs/cpfContrato.job";
import { logComAlerta } from "../utils/logComAlerta.util";

export class ContratoDigitalController {
    static async consultarPorCpfLista(req: Request, res: Response) {
        try {
            const { cpfs } = req.body;

            if (!Array.isArray(cpfs) || cpfs.length === 0) {
                const msg = "O campo 'cpfs' deve ser um array não vazio.";
                await logComAlerta.erro("CPF-Contrato: entrada inválida", msg);
                return res.status(400).json({ error: msg });
            }

            const cpfsLimpos = cpfs
                .map((cpf: string) => (typeof cpf === "string" ? cpf.replace(/[^\d]/g, "") : ""))
                .filter((cpf: string) => cpf.length === 11);

            await adicionarCpfContratoJob(cpfsLimpos);

            const msg = `📨 ${cpfsLimpos.length} CPF(s) adicionados à fila CPF-Contrato.`;
            await logComAlerta.sucesso("Enfileiramento CPF-Contrato", msg);

            return res.status(200).json({ message: msg });
        } catch (error: any) {
            const msg = `Erro ao adicionar CPFs à fila: ${error.message}`;
            await logComAlerta.erro("Erro ao enfileirar CPF-Contrato", msg, error);
            return res.status(500).json({ error: msg });
        }
    }
}
