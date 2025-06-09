module.exports = (sequelize, Sequelize) => {
    const LoteBonuse = sequelize.define("loteBonuse", {
        quantidade: {
            type: Sequelize.STRING
        },
        totalBonificacoes: {
            type: Sequelize.STRING
        },
        previsao: {
            type: Sequelize.STRING
        },
        dataPagamento: {
            type: Sequelize.STRING
        },
        status: {
            type: Sequelize.STRING
        },
        quantidadeEstornos: {
            type: Sequelize.STRING
        },
        totalEstornos: {
            type: Sequelize.STRING
        },
        dataInicial: {
            type: Sequelize.STRING
        },
        dataFinal: {
            type: Sequelize.STRING
        },
        arquivoUrl: {
            type: Sequelize.STRING
        },
        disabled: {
            type: Sequelize.BOOLEAN
        },
    });

    return LoteBonuse;
};