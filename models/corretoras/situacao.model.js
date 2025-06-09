module.exports = (sequelize, Sequelize) => {
    const Situacao = sequelize.define("corretoras_situacoe", {
        nome: {
            type: Sequelize.STRING
        },
        descricao: {
            type: Sequelize.STRING
        },
    });

    return Situacao;
};