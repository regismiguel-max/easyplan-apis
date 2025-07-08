import moment from "moment-timezone";
import api from "../config/axios.config";
import { PropostaModel } from "../models";
import logger from "../config/logger.config";
import { Op } from "sequelize";
import { concurrentMap } from "../utils/concurrentMap.util";

export class PropostaService {
    /**
     * Busca propostas da Planium dos últimos 3 meses, dividindo por dia e status.
     * Remove duplicatas com base no `propostaID`.
     */
    static async buscarPropostasPorData(): Promise<any[]> {
        const hoje = moment().tz("America/Sao_Paulo");
        const tresMesesAtras = hoje.clone().subtract(3, "months");

        const statusList = ["implantada", "integracao"];
        const dias: string[] = [];

        let atual = tresMesesAtras.clone();
        while (atual.isSameOrBefore(hoje, "day")) {
            dias.push(atual.format("YYYY-MM-DD"));
            atual.add(1, "day");
        }

        const combinacoesDeBusca = dias.flatMap(data =>
            statusList.map(status => ({ data, status }))
        );

        const propostasArrays = await concurrentMap(
            combinacoesDeBusca,
            async ({ data, status }) => {
                const body = {
                    cnpj_operadora: "27252086000104",
                    data_inicio: data,
                    data_fim: data,
                    status,
                };

                try {
                    logger.info(`📥 Buscando propostas com status '${status}' para o dia ${data}...`);
                    const response = await api.axiosPlanium.post("proposta/consulta/v1", body);

                    const propostas = response?.data?.propostas;

                    if (Array.isArray(propostas) && propostas.length > 0) {
                        logger.info(`📄 ${propostas.length} propostas encontradas para ${data} [${status}].`);
                        return propostas;
                    } else {
                        logger.info(`📭 Nenhuma proposta encontrada para ${data} [${status}].`);
                    }
                } catch (error: any) {
                    logger.error(`❌ Erro ao buscar propostas para ${data} [${status}]: ${error.message}`);
                }

                await new Promise(resolve => setTimeout(resolve, 200));
                return [];
            },
            4
        );

        const propostasTotais = propostasArrays.flat();

        const propostasUnicas = Object.values(
            propostasTotais.reduce((acc, proposta) => {
                if (proposta?.propostaID) {
                    acc[proposta.propostaID] = proposta;
                }
                return acc;
            }, {} as Record<string, any>)
        );

        logger.info(`📦 Total geral de propostas únicas encontradas: ${propostasUnicas.length}`);
        if (propostasUnicas.length === 0) {
            logger.warn("⚠️ Nenhuma proposta retornada da API Planium.");
        }

        return propostasUnicas;
    }

    /**
     * Busca e salva propostas no banco de dados.
     * Cria novas ou atualiza se já existir pelo `propostaID`.
     */
    static async buscarEArmazenarPropostas(): Promise<{ novas: number; atualizadas: number }> {
        logger.info("💾 Iniciando processo de buscar e armazenar propostas...");
        const propostas = await this.buscarPropostasPorData();

        if (!propostas.length) {
            logger.info("📭 Nenhuma proposta retornada. Processo encerrado.");
            return { novas: 0, atualizadas: 0 };
        }

        const propostaIDs = propostas.map(p => p.propostaID);

        const existentes = await PropostaModel.findAll({
            where: { propostaID: { [Op.in]: propostaIDs } },
            attributes: ["propostaID"],
            raw: true,
        });

        const existentesSet = new Set(existentes.map(p => p.propostaID));

        const novasPropostas = propostas.filter(p => !existentesSet.has(p.propostaID)).map(p => ({
            ...p,
            possui_contrato_digital: false,
        }));

        const atualizaveisPropostas = propostas.filter(p => existentesSet.has(p.propostaID)).map(p => ({
            ...p,
            possui_contrato_digital: false,
        }));

        if (novasPropostas.length > 0) {
            await PropostaModel.bulkCreate(novasPropostas);
        }

        await concurrentMap(
            atualizaveisPropostas,
            async (proposta) => {
                await PropostaModel.update(proposta, {
                    where: { propostaID: proposta.propostaID },
                });
            },
            2
        );

        logger.info(`✅ Propostas processadas. Novas: ${novasPropostas.length}, Atualizadas: ${atualizaveisPropostas.length}`);
        return {
            novas: novasPropostas.length,
            atualizadas: atualizaveisPropostas.length,
        };
    }
}
