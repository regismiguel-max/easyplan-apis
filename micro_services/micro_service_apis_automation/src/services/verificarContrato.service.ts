import api from "../config/axios.config";
import { PropostaModel } from "../models";
import { ContratoHelper } from "../helpers/ContratoHelper";
import { withRateLimit } from "../utils/delay.util";
import logger from "../config/logger.config";
import { ClienteDigitalBeneficiarioAttributes } from "../models/beneficiarios.model";
import { concurrentMap } from "../utils/concurrentMap.util";

export class VerificarContratoService {
    static async verificarContratos(): Promise<{ resumo: string }> {
        logger.info("🔍 Iniciando verificação de contratos digitais...");

        const totalPropostas = {
            processadas: 0,
            comContrato: 0,
            beneficiarios: 0,
            novos: 0,
            atualizados: 0,
            erros: 0,
        };

        try {
            const propostas = await PropostaModel.findAll({
                where: { possui_contrato_digital: false },
            });

            if (!propostas?.length) {
                logger.info("✅ Nenhuma proposta pendente para verificação.");
                return { resumo: "Nenhuma proposta para processar." };
            }

            logger.info(`🔎 ${propostas.length} propostas encontradas para processar.`);

            await concurrentMap(
                propostas,
                async (proposta) => {
                    totalPropostas.processadas++;

                    let cpfsSet = new Set<string>();

                    try {
                        const metadados =
                            typeof proposta.metadados === 'string'
                                ? JSON.parse(proposta.metadados)
                                : proposta.metadados || {};

                        if (Array.isArray(metadados?.titulares_cpf)) {
                            metadados.titulares_cpf
                                .map((cpf: string) => cpf?.replace(/\D/g, ''))
                                .filter((cpf: string) => cpf?.length === 11)
                                .forEach((cpf: string) => cpfsSet.add(cpf));
                        }
                    } catch (e: any) {
                        logger.warn(`⚠️ Metadados inválido na proposta ${proposta.id}: ${e.message}`);
                    }

                    // Sempre adiciona o contratante_cpf (se válido)
                    const fallbackCpf = proposta?.contratante_cpf?.replace(/\D/g, '');
                    if (fallbackCpf && fallbackCpf.length === 11) {
                        cpfsSet.add(fallbackCpf);
                    }

                    const cpfsParaBuscar = Array.from(cpfsSet);

                    for (const cpf of cpfsParaBuscar) {
                        try {
                            const response = await withRateLimit(() =>
                                api.axiosDigital.get(`contrato/procurarPorCpfTitular?cpf=${cpf}`),
                                { delayMs: 500, retries: 3, backoffFactor: 2 }
                            );

                            const contratos = response?.data;
                            if (!Array.isArray(contratos) || contratos.length === 0) {
                                logger.warn(`⚠️ Nenhum contrato encontrado para CPF ${cpf}`);
                                continue;
                            }

                            let houvePersistencia = false;

                            for (const contrato of contratos) {
                                const beneficiarios = contrato?.beneficiarioList;
                                if (!Array.isArray(beneficiarios) || beneficiarios.length === 0) continue;

                                const infoComum = ContratoHelper.extrairInfoComum(contrato);
                                const beneficiariosDados: Partial<ClienteDigitalBeneficiarioAttributes>[] = [];

                                for (const beneficiario of beneficiarios) {
                                    if (!beneficiario?.cpf || !beneficiario?.codigo) {
                                        logger.warn(`⚠️ Beneficiário inválido em contrato ${contrato?.codigo}.`);
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
                                        valor_contrato: beneficiario?.tipoBeneficiario?.nome === 'Titular' ? contrato.valor : null,
                                    };

                                    beneficiariosDados.push(dados);
                                }

                                if (beneficiariosDados.length > 0) {
                                    const { novos, atualizados } = await ContratoHelper.bulkSalvarOuAtualizarBeneficiarios(
                                        beneficiariosDados
                                    );

                                    totalPropostas.beneficiarios += novos + atualizados;
                                    totalPropostas.novos += novos;
                                    totalPropostas.atualizados += atualizados;
                                    houvePersistencia ||= novos > 0 || atualizados > 0;

                                    logger.info(`💾 Contrato ${contrato.codigo}: ${novos} novos, ${atualizados} atualizados.`);
                                }
                            }

                            if (houvePersistencia) {
                                await proposta.update({ possui_contrato_digital: true });
                                totalPropostas.comContrato++;
                                logger.info(`📌 Proposta ${proposta.id} marcada como com contrato digital.`);
                            }
                        } catch (erroInterno: any) {
                            totalPropostas.erros++;
                            logger.error(`❌ Erro ao consultar contrato para CPF ${cpf}: ${erroInterno.message}`);
                        }
                    }
                }, 2
            );

            logger.info("✅ Verificação de contratos concluída.");

            return {
                resumo: `* Propostas: ${totalPropostas.processadas},\n * Com contrato: ${totalPropostas.comContrato},\n * Beneficiários salvos: ${totalPropostas.beneficiarios},\n * Novos: ${totalPropostas.novos},\n * Atualizados: ${totalPropostas.atualizados},\n * Erros: ${totalPropostas.erros}`,
            };
        } catch (error: any) {
            logger.error(`❌ Erro ao verificar contratos: ${error.message}`);
            return { resumo: `Erro geral na verificação: ${error.message}` };
        }
    }
}
