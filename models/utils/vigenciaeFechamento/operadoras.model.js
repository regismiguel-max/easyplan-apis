module.exports = (sequelize, Sequelize) => {
    const Operadoras = sequelize.define("utils_vigencia_e_fechamento_operadora", {
        operadoraID: {
            type: Sequelize.STRING,
        },
        nomeFantasia: {
            type: Sequelize.STRING
        },
        razaoSocial: {
            type: Sequelize.STRING
        },
        estadoID: {
            type: Sequelize.STRING
        },
    });

    return Operadoras;
};