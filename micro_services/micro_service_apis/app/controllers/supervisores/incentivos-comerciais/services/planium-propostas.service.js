const { https: api } = require("../../../../config/axios/axios.config");
const db = require("../../../../../../../models");
const { where } = require("sequelize");
class PlaniumPropostaService {
    async getPropostas(planiumPayload) {
        const dias = this._gerarIntervaloDias(planiumPayload);
        if (!dias.length) {
            console.log("Nenhuma data válida para consulta");
            return;
        }
        console.log('Vejamos como ficou a lista de dias:', dias);
        

        const propostasPlanium = await this._buscarPropostasPorDias(dias, planiumPayload);
        console.log('Vejamos como ficou a lista das propostas: ', propostasPlanium);
        

        if (!propostasPlanium.length) {
            console.log("Nenhuma venda realizada no intervalo");
            return;
        }
        
        const novasPropostas = await this._processarPropostas(propostasPlanium, planiumPayload);

        let beneficiarios = 0;

        if(novasPropostas.length > 0){
            console.log('Tem novas propostas XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
            console.log(novasPropostas);
            
            beneficiarios = await novasPropostas.map(proposta => proposta.beneficiarios).reduce((acc, val) => acc + val, 0);
        } else {
            console.log('Sem novas propostas');
            
            beneficiarios = await propostasPlanium.map(proposta => proposta.beneficiarios).reduce((acc, val) => acc + val, 0);
        }


        console.log('Veja os beneficiarios: ', beneficiarios);
        
        await this._atualizarResultados(planiumPayload.id, novasPropostas, propostasPlanium, beneficiarios);

        return
    }

    // Gera intervalo de dias
    _gerarIntervaloDias(planiumPayload) {
        const hoje = new Date();
        const inicio = new Date(planiumPayload.startDate);
        const fim = new Date(planiumPayload.endDate);

        console.log('Hoje: ', hoje);
        console.log('Final do Desafio: ', fim);

        const limit = hoje > fim ? fim : hoje;

        const dias = [];
        for (let data = new Date(inicio); data <= limit; data.setDate(data.getDate() + 1)) {
            dias.push(data.toISOString().split("T")[0]);
        }

        if (dias[0] < inicio.toISOString().split("T")[0]) dias.shift();

        return dias;
    }

    // Consulta a API para cada dia
    async _buscarPropostasPorDias(dias, planiumPayload) {
        // Requisição para a planium para cada dia, buscando as propostas existentes nesse dia
        let propostasPlanium = [];
        for (const dia of dias) {
            const bodyRequest = {
                cnpj_operadora: "27252086000104",
                data_inicio: dia,
                data_fim: dia,
                corretora_cnpj: planiumPayload.cnpj,
            };

            const response = await api.post("proposta/consulta/v1", bodyRequest);
            // console.log('Retorno plenium: ', response.data.propostas);
            console.log('Retorno plenium: ', response.data.propostas.length);

            // Iterar sobre cada proposta e filtrar proposta que seja da mesma corretora, e se o status dessa proposta é diferente de cancelada.
            const propostasDoDia = await response.data.propostas.filter(
                (proposta) => {
                    return proposta.status !== 'cancelada' && proposta.status !== 'retificada';
                }
            )
            console.log('proposta dia: ', propostasDoDia);

            propostasPlanium.push(...propostasDoDia);
        }
        
        return propostasPlanium;
    }

    // Persiste propostas no banco e retorna apenas as novas
    async _processarPropostas(propostas, planiumPayload) {
        const novasPropostas = [];

        for (const proposta of propostas) {
            const propostaObj = this._mapProposta(proposta, planiumPayload.id);

            const existing = await db.incentives_propostas.findOne({
                where: { propostaID: propostaObj.propostaID }
            });

            if (existing) {
                // console.log('Incentivo Proposta antes da manipulação: ', existing);
                
                const incentive_proposta = existing.get({plain: true});

                // console.log('Incentivo Proposta depois da manipulação: ', incentive_proposta);
                
                if(propostaObj.status !== incentive_proposta.status){
                    await existing.update({ status: propostaObj.status });
                }
            } else {
                await db.incentives_propostas.create(propostaObj);
                novasPropostas.push(proposta);
            }
        }

        return novasPropostas;
    }

    _mapProposta(proposta, incentiveId) {
        let propostasPayload = {
            produto: proposta.produto,
            status: proposta.status,
            data_assinatura: proposta.date_sig,
            data_criacao: proposta.datacriacao,
            vendedor_cpf: proposta.vendedor_cpf,
            vendedor_nome: proposta.vendedor_nome,
            corretora_cnpj: proposta.corretora_cnpj,
            corretora_nome: proposta.corretora_nome,
            contratante_nome: proposta.contratante_nome,
            contratante_email: proposta.contratante_email,
            uf: proposta.uf,
            total_valor: proposta.total_valor,
            operadora: proposta.metadados?.operadora_nome ?? null,
            incentive_id: incentiveId,
            propostaID: proposta.propostaID.toString(),
            // contratante_cpf: proposta.contratante_cpf,
            beneficiarios: proposta.beneficiarios,
            data_vigencia: proposta.date_vigencia
        };

        if(proposta.metadados && proposta.metadados.titulares_cpf && proposta.metadados.titulares_cpf.length > 0) {
            console.log('Quero vê como que é esse array do cpf do titular: ', proposta.metadados.titulares_cpf);
            console.log('Quero vê o do contratante também: ', proposta.contratante_cpf);
            
            propostasPayload.contratante_cpf = proposta.metadados.titulares_cpf[0];
        } else {
            propostasPayload.contratante_cpf = proposta.contratante_cpf;
        }

        return propostasPayload;  
    }

    async _atualizarResultados(incentiveId, novasPropostas, propostasPlanium, beneficiarios) {
        const existingResult = await db.incentives_results.findOne({
            where: { incentive_id: incentiveId },
            attributes: ["total_sales", "total_lifes"]
        });

        if (existingResult) {
            if (novasPropostas) {
                let total_sales = Number(existingResult.dataValues.total_sales) || 0;
                total_sales += novasPropostas.length;
     
                let total_lifes = Number(existingResult.dataValues.total_lifes) || 0;
                total_lifes += beneficiarios;
                 
                await db.incentives_results.update({ total_sales, total_lifes }, { where: { incentive_id: incentiveId } });
            }
        } else {
            await db.incentives_results.create({
                incentive_id: incentiveId,
                total_sales: propostasPlanium.length,
                total_lifes: beneficiarios
            });
        }
    }
}

module.exports = PlaniumPropostaService;
