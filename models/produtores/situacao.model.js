module.exports = (sequelize, Sequelize) => {
    const Situacao = sequelize.define("produtores_situacoe", {
        nome: {
            type: Sequelize.STRING
        },
        descricao: {
            type: Sequelize.STRING
        },
    });

    return Situacao;
};