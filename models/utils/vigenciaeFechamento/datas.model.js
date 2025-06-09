module.exports = (sequelize, Sequelize) => {
    const Datas = sequelize.define("utils_vigencia_e_fechamento_datas", {
        dataVigencia: {
            type: Sequelize.STRING
        },
        dataHoraFechamento: {
            type: Sequelize.STRING
        },
        dataVencimento: {
            type: Sequelize.STRING
        },
        dataInicio: {
            type: Sequelize.STRING
        },
        dataFim: {
            type: Sequelize.STRING
        },
        status: {
            type: Sequelize.BOOLEAN,
            default: false
        },
        operadoraID: {
            type: Sequelize.STRING,
        },
        estadoID: {
            type: Sequelize.STRING
        },
    });

    return Datas;
};