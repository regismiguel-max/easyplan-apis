const { where, Op, Sequelize } = require("sequelize");
const db = require("../../../../../../models");
const { digital: api } = require("../../../config/axios/axios.config");

function bringMonth(finalData) {
  // Cria um objeto Date a partir da string
  const dateObj = new Date(finalData);

  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  // Extrai o número do mês (0 a 11)
  const numeroMes = dateObj.getMonth() + 1; // +1 para ajustar
  const nomeMes = meses[dateObj.getMonth()];

  // console.log(numeroMes.toString().padStart(2, '0')); // "05"
  // console.log(nomeMes); // "Maio"

  return nomeMes;
}

async function updateBeneficiaryPayments() {
    try {
        // Pegar todos os incentivos que tem o status de Encerrado
        const incentivos = await getClosedIncentives();
        
        // Pegar apenas os ids desses incentivos
        const incentivosIds = incentivos.map(incentivo => incentivo.id);
    
        // Pegar todas as propostas dos respectivos incentivos que estão com o status não pago
        const propostas = await getUnpaidProposals(incentivosIds);
        if (!propostas.length) throw new Error('Retorno de consultas necessárias vieram vazias');
        
        // Realizar a query no nosso banco Buscando o codigo_do_contrato na tabela de Beneficiário através do CPF
        const codigos_cpfs = await getContractCodes(propostas);
        if (!codigos_cpfs.length) throw new Error('Retorno de consultas necessárias vieram vazias');
        // console.log('Vejamos como ficou o final de tudo: ', codigos_cpfs);
    
        const beneficiariosPagou = await getPaymentsFromDigitalSaude(codigos_cpfs);
    
        // Persistir as informações necessárias no banco de propostas
        const updateReturn = await updateProposalWithPayments(beneficiariosPagou);
    
        return;
    } catch (error) {
        console.log('Teve algum erro durante o fluxo de atualização dos beneficiarios que realizou o pagemento: ', error);

        throw error;
    }
}

async function getClosedIncentives() {
    try {
        const incentivosDB = await db.incentives.findAll(
            {
                where: {status: 'Encerrado'}
            }
        )

        const incentivos = incentivosDB.map(incentivo => incentivo.get({plain: true}));

        return incentivos;
    } catch (error) {
        console.log('Error durante a buscar por incentivos que estão com status encerrado: ', error);

        throw error;
    }
}

async function getUnpaidProposals(incentivesIds) {
    try {
        const propostasDB = await db.incentives_propostas.findAll({
            where: {
                pagou: false,
                incentive_id: {
                    [Op.in]: incentivesIds
                }
            },
        });
        
        const propostas = propostasDB.map((proposta) => proposta.get({ plain: true }));
        
        return propostas;
    } catch (error) {
        console.log('Error durante a buscar por propostas que estão com status de pagamento false: ', error);

        throw error;
    }
}

async function getContractCodes(propostas) {
    let codigos_cpfs = [];

    for (let proposta of propostas) {
        try {
            const codigoDB = await db.beneficiariosDigital.findOne({
                where: { numero_da_proposta: proposta.propostaID },
                attributes: ["codigo_do_contrato"],
            });
    
            if (!codigoDB) {
                console.log("Null");
    
                continue;
            }
    
            const codigo = codigoDB.get({ plain: true });
    
            codigos_cpfs.push({
                cpf: proposta.contratante_cpf,
                codigo,
            });
        } catch (error) {
            console.log('Error durante a buscar dos códigos dos contratos através do ID da proposta: ', error);
            
            throw error
        }
    }

    return codigos_cpfs;
}

async function getPaymentsFromDigitalSaude(codigos_cpfs) {
    let beneficiariosPagou = [];
    
    // Realizar a query no Digital Saúde por Fatura paga através do codigo_do_contrato do Beneficiário
    for (let codigo_cpf of codigos_cpfs) {
        try {
            const codigo = codigo_cpf.codigo.codigo_do_contrato;
        
            const retornoDigital = await api.get( `/fatura/procurarLiquidadasPorContrato?codigoContrato=${codigo}` );
        
            console.log("Vamos vê a resposta da Digital Saúde: ", retornoDigital.data);
                    // console.log('Vamos vê a resposta da Digital Saúde: ', retornoDigital.data[0]);
                    // console.log('Vejamos os beneficiarios: ', retornoDigital.data[0]?.beneficiario);
                    // console.log('Vejamos o status: ', retornoDigital.data[0]?.statusFatura);
        
            if (!retornoDigital?.data || retornoDigital?.data?.length === 0) {
                continue;
            }
        
            if (retornoDigital?.data?.length > 1) {
                for (let parcela of retornoDigital.data) {
                    if (parcela.numero === 1) {
                        console.log("Tem mais de uma parcela");
        
                        beneficiariosPagou.push({
                            pagou: true,
                            codigo: codigo,
                            dataPagamento: parcela.dataPagamento,
                            contratante_cpf: codigo_cpf.cpf,
                        });
                    }
                }
    
                continue;
            }
        
            beneficiariosPagou.push({
                pagou: true,
                codigo: codigo,
                dataPagamento: retornoDigital.data[0].dataPagamento,
                contratante_cpf: codigo_cpf.cpf,
            });
        } catch (error) {
            console.error( 'Ocorreu um erro na requisição para o código: ', error );
            if(error.status === 400 && error.response.data.includes('Nenhuma fatura localizada')) {
                continue;
            }
        
            throw error
        }
    }

    return beneficiariosPagou;
}

async function updateProposalWithPayments(beneficiariosPagou){
    // console.log('Veja a lista de quem pagou: ', beneficiariosPagou);
    let updateReturn = [];

    for (let beneficiarioPagou of beneficiariosPagou) {
        try {
            const [response] = await db.incentives_propostas.update(
                {
                    pagou: beneficiarioPagou.pagou,
                    codigo_do_contrato: beneficiarioPagou.codigo,
                    data_pagamento: beneficiarioPagou.dataPagamento,
                },
                {
                    where: { contratante_cpf: beneficiarioPagou.contratante_cpf },
                }
            );
    
            if (response > 0) {
                updateReturn.push({ cpf: beneficiarioPagou.contratante_cpf, status: "atualizado" });
            } else {
                console.log(`{ cpf: ${beneficiarioPagou.contratante_cpf}, status: "não encontrado" }`);
                updateReturn.push({ cpf: beneficiarioPagou.contratante_cpf, status: "não encontrado" });
            }
        } catch (error) {
            console.log('Error durante a atualização de propostas que houve pagamento: ', error);
    
            throw error;
        }
    }

    return updateReturn;
}

module.exports = {bringMonth, updateBeneficiaryPayments};
