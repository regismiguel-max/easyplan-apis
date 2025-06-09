module.exports = (sequelize, Sequelize) => {
    const Operadoras = sequelize.define("utils_regras_de_bonificacao_operadora", {
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