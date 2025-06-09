module.exports = (sequelize, Sequelize) => {
    const Commission = sequelize.define("corretoras_commissions_commission", {
        corretora: {
            type: Sequelize.STRING
        },
        corretora_CNPJ: {
            type: Sequelize.STRING
        },
        produtor: {
            type: Sequelize.STRING
        },
        nome_contrato: {
            type: Sequelize.STRING
        },
        cpf_cnpj_contrato: {
            type: Sequelize.STRING
        },
        operadora: {
            type: Sequelize.STRING
        },
        modalidade: {
            type: Sequelize.STRING
        },
        parcela: {
            type: Sequelize.STRING
        },
        percentual_comissao: {
            type: Sequelize.STRING
        },
        vidas: {
            type: Sequelize.STRING
        },
        data_previsao: {
            type: Sequelize.STRING
        },
        data_pagamento: {
            type: Sequelize.STRING
        },
        valor_contrato: {
            type: Sequelize.STRING
        },
        valor_provisionado: {
            type: Sequelize.STRING
        },
        situacao_ID: {
            type: Sequelize.STRING
        },
        motivo: {
            type: Sequelize.STRING
        },
        status_ID: {
            type: Sequelize.STRING
        },
        sub_lote_commissions_ID: {
            type: Sequelize.STRING
        },
        lote_commissions_ID: {
            type: Sequelize.STRING
        },
        nf_ID: {
            type: Sequelize.STRING
        },
        codigoCommissionsDigitalSaude: {
            type: Sequelize.STRING
        },
    });

    return Commission;
};