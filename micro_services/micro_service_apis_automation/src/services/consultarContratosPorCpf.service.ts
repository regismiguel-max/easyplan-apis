import api from "../config/axios.config";
import logger from "../config/logger.config";
import { ContratoHelper } from "../helpers/ContratoHelper";
import { withRateLimit } from "../utils/delay.util";
import { ClienteDigitalBeneficiarioModel } from "../models";
import { concurrentMap } from "../utils/concurrentMap.util";

export interface ResultadoConsultaCPF {
    cpf: string;
    status: "criado" | "atualizado" | "nao_encontrado" | "erro";
    mensagem: string;
}

export class ConsultarContratosPorCpfService {
    static async consultar(cpfs: string[]): Promise<ResultadoConsultaCPF[]> {
        logger.info(`📥 Iniciando consulta de contratos para ${cpfs.length} CPF(s)...`);

        const resultadosArrays = await concurrentMap(
            cpfs,
            async (cpf): Promise<ResultadoConsultaCPF[]> => {
                if (!cpf || typeof cpf !== "string") {
                    logger.warn(`⚠️ CPF inválido: ${cpf}`);
                    return [{ cpf, status: "erro", mensagem: "CPF inválido" }];
                }

                try {
                    const response = await withRateLimit(
                        () => api.axiosDigital.get(`contrato/procurarPorCpfTitular?cpf=${cpf}`),
                        { delayMs: 500, retries: 3, backoffFactor: 2 }
                    );

                    const contratos = response?.data;
                    if (!Array.isArray(contratos) || contratos.length === 0) {
                        logger.warn(`⚠️ Nenhum contrato encontrado para CPF ${cpf}`);
                        return [{ cpf, status: "nao_encontrado", mensagem: "Nenhum contrato encontrado" }];
                    }

                    let houvePersistencia = false;
                    let houveCriacao = false;

                    for (const contrato of contratos) {
                        const beneficiarios = contrato?.beneficiarioList;
                        if (!Array.isArray(beneficiarios) || beneficiarios.length === 0) continue;

                        const infoComum = ContratoHelper.extrairInfoComum(contrato);

                        for (const beneficiario of beneficiarios) {
                            if (!beneficiario?.cpf || !beneficiario?.codigo) {
                                logger.warn(`⚠️ Beneficiário inválido em contrato ${contrato?.codigo}.`);
                                continue;
                            }

                            const idade = ContratoHelper.calcularIdade(beneficiario.dataNascimento);

                            const dados = {
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

                            const jaExiste = await ClienteDigitalBeneficiarioModel.findOne({
                                where: {
                                    cpf: beneficiario?.cpf,
                                    codigo_do_contrato: contrato?.codigo,
                                    codigo_do_beneficiario: beneficiario?.codigo,
                                },
                            });

                            const sucesso = await ContratoHelper.salvarOuAtualizarBeneficiario(
                                beneficiario?.cpf,
                                contrato?.codigo,
                                beneficiario?.codigo,
                                dados
                            );

                            if (sucesso) {
                                const tipo = jaExiste ? "atualizado" : "criado";
                                logger.info(`💾 Beneficiário ${beneficiario?.nome} (${beneficiario?.cpf}) ${tipo} com sucesso.`);
                                houvePersistencia = true;
                                if (!jaExiste) houveCriacao = true;
                            }
                        }
                    }

                    if (houvePersistencia) {
                        return [{
                            cpf,
                            status: houveCriacao ? "criado" : "atualizado",
                            mensagem: houveCriacao ? "Novo(s) beneficiário(s) criado(s)" : "Beneficiário(s) atualizado(s)"
                        }];
                    } else {
                        return [{ cpf, status: "nao_encontrado", mensagem: "Nenhum beneficiário persistido" }];
                    }
                } catch (error: any) {
                    logger.error(`❌ Erro ao consultar contrato para CPF ${cpf}: ${error.message}`);
                    return [{ cpf, status: "erro", mensagem: error.message }];
                }
            },
            2
        );

        logger.info("✅ Consulta de contratos finalizada.");
        return resultadosArrays.flat();
    }
}
