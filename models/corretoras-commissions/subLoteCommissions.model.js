module.exports = (sequelize, Sequelize) => {
    const SubLoteCommission = sequelize.define("corretoras_commissions_sub_lotes", {
        corretora: {
            type: Sequelize.STRING
        },
        corretora_CNPJ: {
            type: Sequelize.STRING
        },
        quantidade: {
            type: Sequelize.STRING
        },
        total_contrato: {
            type: Sequelize.STRING
        },
        total_provisionado: {
            type: Sequelize.STRING
        },
        quantidade_commissions: {
            type: Sequelize.STRING
        },
        total_commissions: {
            type: Sequelize.STRING
        },
        quantidade_estornos: {
            type: Sequelize.STRING
        },
        total_estornos: {
            type: Sequelize.STRING
        },
        data_previsao: {
            type: Sequelize.STRING
        },
        data_pagamento: {
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
        lote_commissions_ID: {
            type: Sequelize.STRING
        },
        nf_ID: {
            type: Sequelize.STRING
        },
        empresa_ID: {
            type: Sequelize.STRING
        },
        disabled: {
            type: Sequelize.BOOLEAN
        },
    });

    return SubLoteCommission;
};