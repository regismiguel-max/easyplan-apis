module.exports = (sequelize, Sequelize) => {
    const LoteCommission = sequelize.define("corretoras_commissions_lotes", {
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
        total_estorno: {
            type: Sequelize.STRING
        },
        dataInicial: {
            type: Sequelize.STRING
        },
        dataFinal: {
            type: Sequelize.STRING
        },
        data_previsao: {
            type: Sequelize.STRING
        },
        status_ID: {
            type: Sequelize.STRING
        },
        empresa_ID: {
            type: Sequelize.STRING
        },
        arquivo_URL: {
            type: Sequelize.STRING
        },
        disabled: {
            type: Sequelize.BOOLEAN
        },
    });

    return LoteCommission;
};