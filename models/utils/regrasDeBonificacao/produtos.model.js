module.exports = (sequelize, Sequelize) => {
    const Produtos = sequelize.define("utils_regras_de_bonificacao_produto", {
        produtoID: {
            type: Sequelize.STRING,
        },
        nome: {
            type: Sequelize.STRING
        },
        idade: {
            type: Sequelize.STRING
        },
        valorPorVida: {
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

    return Produtos;
};