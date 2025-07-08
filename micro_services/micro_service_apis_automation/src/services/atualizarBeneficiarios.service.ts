import api from "../config/axios.config";
import { ClienteDigitalBeneficiarioModel } from "../models";
import { ContratoHelper } from "../helpers/ContratoHelper";
import { withRateLimit } from "../utils/delay.util";
import logger from "../config/logger.config";
import { ClienteDigitalBeneficiarioAttributes } from "../models/beneficiarios.model";
import { concurrentMap } from "../utils/concurrentMap.util";

export class AtualizarBeneficiariosService {
    static async atualizarBeneficiarios(): Promise<{ resumo: string }> {
        logger.info("🔄 Iniciando atualização de beneficiários...");

        const stats = {
            titulares: 0,
            beneficiariosAtualizados: 0,
            beneficiariosNovos: 0,
            beneficiariosIgnorados: 0,
            erros: 0,
        };

        try {
            const titulares = await ClienteDigitalBeneficiarioModel.findAll({
                where: { tipo_de_beneficiario: "Titular" },
                attributes: ["cpf"],
            }) as unknown as Pick<ClienteDigitalBeneficiarioAttributes, "cpf">[];

            if (!titulares?.length) {
                logger.info("✅ Nenhum titular encontrado para atualização.");
                return { resumo: "Nenhum titular encontrado." };
            }

            const cpfs = [
                ...new Set(titulares.map(t => t?.cpf).filter((cpf): cpf is string => Boolean(cpf))),
            ];

            logger.info(`🔍 ${cpfs.length} CPFs de titulares encontrados para atualização.`);

            await concurrentMap(
                cpfs,
                async (cpf) => {
                    stats.titulares++;

                    try {
                        const response = await withRateLimit(
                            () => api.axiosDigital.get(`contrato/procurarPorCpfTitular?cpf=${cpf}`),
                            { delayMs: 500, retries: 3, backoffFactor: 2 }
                        );

                        const contratos = response?.data;
                        if (!Array.isArray(contratos) || contratos.length === 0) {
                            logger.warn(`⚠️ Nenhum contrato retornado para CPF ${cpf}`);
                            return;
                        }

                        for (const contrato of contratos) {
                            const beneficiarios = contrato?.beneficiarioList;
                            if (!Array.isArray(beneficiarios) || beneficiarios.length === 0) continue;

                            const infoComum = ContratoHelper.extrairInfoComum(contrato);
                            const beneficiariosDados: Partial<ClienteDigitalBeneficiarioAttributes>[] = [];

                            for (const beneficiario of beneficiarios) {
                                if (!beneficiario?.cpf || !beneficiario?.codigo) {
                                    logger.warn(`⚠️ Beneficiário inválido em contrato ${contrato?.codigo}.`);
                                    stats.beneficiariosIgnorados++;
                                    continue;
                                }

                                const idade = ContratoHelper.calcularIdade(beneficiario.dataNascimento);

                                const dados: Partial<ClienteDigitalBeneficiarioAttributes> = {
                                    ...infoComum,
                                    id_beneficiario: beneficiario?.id,
                                    codigo_do_beneficiario: beneficiario?.codigo,
                                    marca_optica: beneficiario?.marcaOptica ?? null,
                                    marca_optica_opcional: beneficiario?.marcaOpticaOpcional ?? null,
                                    nome_do_beneficiario: beneficiario?.nome,
                                    data_de_nascimento: beneficiario?.dataNascimento,
                                    idade,
                                    rg: beneficiario?.rg ?? null,
                                    orgao_emissor: beneficiario?.orgaoEmissor ?? null,
                                    cpf: beneficiario?.cpf ?? null,
                                    dnv: beneficiario?.dnv ?? null,
                                    cns: beneficiario?.cns ?? null,
                                    pis: beneficiario?.pis ?? null,
                                    nome_da_mae: beneficiario?.nomeMae ?? null,
                                    endereco: beneficiario?.endereco,
                                    numero: beneficiario?.numero ?? null,
                                    complemento: beneficiario?.complemento ?? null,
                                    bairro: beneficiario?.bairro ?? null,
                                    municipio: beneficiario?.municipio,
                                    uf: beneficiario?.uf,
                                    cep: beneficiario?.cep,
                                    ddd_telefone: beneficiario?.dddTelefone ?? null,
                                    telefone: beneficiario?.telefone ?? null,
                                    ddd_celular: beneficiario?.dddCelular ?? null,
                                    celular: beneficiario?.celular ?? null,
                                    email_principal: beneficiario?.email ?? null,
                                    email_secundario: beneficiario?.emailSecundario ?? null,
                                    altura: beneficiario?.altura ?? null,
                                    peso: beneficiario?.peso ?? null,
                                    imc: beneficiario?.imc ?? null,
                                    vigencia: beneficiario?.dataVigencia,
                                    carencia: beneficiario?.carencia ?? null,
                                    estado_civil: beneficiario?.estadoCivil?.nome ?? null,
                                    tipo_de_beneficiario: beneficiario?.tipoBeneficiario?.nome ?? null,
                                    sexo: beneficiario?.sexo?.nome ?? null,
                                    parentesco: beneficiario?.parentesco?.nome ?? null,
                                    status_do_beneficiario: beneficiario?.statusBeneficiario?.nome ?? null,
                                };

                                beneficiariosDados.push(dados);
                            }

                            if (beneficiariosDados.length > 0) {
                                const { novos, atualizados } =
                                    await ContratoHelper.bulkSalvarOuAtualizarBeneficiarios(beneficiariosDados);

                                stats.beneficiariosNovos += novos;
                                stats.beneficiariosAtualizados += atualizados;

                                logger.info(`🔁 Contrato ${contrato.codigo}: ${novos} novos, ${atualizados} atualizados.`);
                            }
                        }
                    } catch (err: any) {
                        stats.erros++;
                        logger.error(`❌ Erro ao atualizar beneficiários para CPF ${cpf}: ${err.message}`);
                    }
                },
                2
            );

            logger.info("✅ Atualização de beneficiários concluída.");

            return {
                resumo: `* Titulares: ${stats.titulares},\n * Novos: ${stats.beneficiariosNovos},\n * Atualizados: ${stats.beneficiariosAtualizados},\n * Ignorados: ${stats.beneficiariosIgnorados},\n * Erros: ${stats.erros}`,
            };
        } catch (error: any) {
            logger.error(`❌ Erro geral na atualização de beneficiários: ${error.message}`);
            return { resumo: `Erro geral: ${error.message}` };
        }
    }
}
