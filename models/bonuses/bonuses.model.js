module.exports = (sequelize, Sequelize) => {
    const Bonuse = sequelize.define("bonuse", {
        cliente: {
            type: Sequelize.STRING
        },
        documento: {
            type: Sequelize.STRING
        },
        bonificacao: {
            type: Sequelize.STRING
        },
        estorno: {
            type: Sequelize.STRING
        },
        tipo: {
            type: Sequelize.STRING
        },
        descricao: {
            type: Sequelize.STRING
        },
        previsao: {
            type: Sequelize.STRING
        },
        dataPagamento: {
            type: Sequelize.STRING
        },
        vigencia: {
            type: Sequelize.STRING
        },
        numeroParcela: {
            type: Sequelize.STRING
        },
        status: {
            type: Sequelize.STRING
        },
        produtor: {
            type: Sequelize.STRING
        },
        idLoteBonuses: {
            type: Sequelize.STRING
        },
        dataLancamento: {
            type: Sequelize.STRING
        },
        codigoBonusesDigitalSaude: {
            type: Sequelize.STRING
        },
        codigoProduto: {
            type: Sequelize.STRING
        },
        nomeProduto: {
            type: Sequelize.STRING
        },
    });

    return Bonuse;
};