import moment from "moment-timezone";
import ClienteDigitalBeneficiarioModel, { ClienteDigitalBeneficiarioAttributes } from "../models/beneficiarios.model";
import logger from "../config/logger.config";

export class ContratoHelper {
    /**
     * Extrai informações comuns do contrato para uso em cada beneficiário.
     */
    static extrairInfoComum(contrato: Record<string, any>): Record<string, any> {
        const inclusao = contrato?.dataInclusao;
        const exclusao = contrato?.dataExclusao || moment().tz("America/Sao_Paulo").format("DD/MM/YYYY");

        const diasDePermanencia = inclusao
            ? moment(exclusao, "DD/MM/YYYY").diff(moment(inclusao, "DD/MM/YYYY"), "days").toString()
            : null;

        return {
            operadora: contrato?.plano?.produto?.operadora?.nome ?? null,
            convenio: contrato?.convenio?.nome ?? null,
            grupo: contrato?.grupo?.nome ?? null,
            subestipulante: contrato?.grupo?.subEstipulanteApi?.nome ?? null,
            data_proximo_reajuste: contrato?.convenio?.dataProximoReajuste ?? null,
            codigo_do_contrato: contrato?.codigo ?? null,
            data_de_cancelamento: contrato?.dataExclusao ?? null,
            data_de_exclusao: contrato?.dataExclusao ?? null,
            numero_da_proposta: contrato?.numeroProposta ?? null,
            data_de_inclusao: inclusao ?? null,
            data_de_assinatura: contrato?.dataAssinatura ?? null,
            dias_de_permanencia: diasDePermanencia,
            dia_vencimento: contrato?.diaVencimento ?? null,
            plano: contrato?.plano?.nome ?? null,
            acomodacao: contrato?.plano?.acomodacaoApi?.nome ?? null,
            produto: contrato?.plano?.produto?.nome ?? null,
            documento_corretor: contrato?.produtor?.numeroDocumento ?? null,
            codigo_corretor: contrato?.produtor?.codigo ?? null,
            nome_corretor: contrato?.produtor?.nome ?? null,
            grupo_corretor: contrato?.produtor?.grupoProdutor?.nome ?? null,
            documento_supervisor: contrato?.supervisor?.numeroDocumento ?? null,
            nome_supervisor: contrato?.supervisor?.nome ?? null,
            documento_corretora: contrato?.corretora?.numeroDocumento ?? null,
            nome_corretora: contrato?.corretora?.nome ?? null,
            grupo_corretora: contrato?.corretora?.grupoProdutor?.nome ?? null,
            documento_angariador: contrato?.angariador?.numeroDocumento ?? null,
            angariador: contrato?.angariador?.nome ?? null,
            nome_responsavel_financeiro: contrato?.nomeResponsavel ?? null,
            cpf_responsavel: contrato?.cpfResponsavel ?? null,
            forma_de_ajuste: contrato?.formaAjuste?.nome ?? null,
            ajuste: contrato?.ajuste ?? null,
            origem_de_venda: contrato?.origemVenda?.nome ?? null,
        };
    }

    static calcularIdade(dataNascimento: string): string | null {
        if (!dataNascimento) return null;

        const data = moment(dataNascimento, "DD/MM/YYYY", true);
        if (!data.isValid()) return null;

        return moment().diff(data, "years").toString();
    }

    static async salvarOuAtualizarBeneficiario(
        cpf: string,
        codigoContrato: string,
        codigoBeneficiario: string,
        dados: Record<string, any>
    ): Promise<boolean> {
        if (!cpf || !codigoContrato || !codigoBeneficiario) {
            logger.warn(
                `⚠️ Dados obrigatórios ausentes para salvar beneficiário: cpf=${cpf}, contrato=${codigoContrato}, beneficiario=${codigoBeneficiario}`
            );
            return false;
        }

        try {
            const existente = await ClienteDigitalBeneficiarioModel.findOne({
                where: {
                    cpf,
                    codigo_do_contrato: codigoContrato,
                    codigo_do_beneficiario: codigoBeneficiario,
                },
            });

            if (existente) {
                await existente.update(dados);
            } else {
                await ClienteDigitalBeneficiarioModel.create(dados);
            }

            return true;
        } catch (error: any) {
            logger.error(`❌ Erro ao salvar/atualizar beneficiário (${cpf}): ${error.message}`);
            return false;
        }
    }

    /**
     * Salva ou atualiza múltiplos beneficiários usando bulkCreate com updateOnDuplicate.
     */
    static async bulkSalvarOuAtualizarBeneficiarios(
        dados: Partial<ClienteDigitalBeneficiarioAttributes>[]
    ): Promise<{ novos: number; atualizados: number }> {
        try {
            if (!dados.length) return { novos: 0, atualizados: 0 };

            const updateFields = Object.keys(dados[0]).filter(
                (key) => !['cpf', 'codigo_do_contrato', 'codigo_do_beneficiario'].includes(key)
            ) as (keyof ClienteDigitalBeneficiarioAttributes)[];

            const result = await ClienteDigitalBeneficiarioModel.bulkCreate(dados, {
                updateOnDuplicate: updateFields,
            });

            const atualizados = result.filter((r: any) => !r._options?.isNewRecord).length;
            const novos = dados.length - atualizados;

            return { novos, atualizados };
        } catch (error: any) {
            logger.error(`❌ Erro no bulkSalvarOuAtualizarBeneficiarios: ${error.message}`);
            return { novos: 0, atualizados: 0 };
        }
    }
}
