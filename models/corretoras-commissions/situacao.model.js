module.exports = (sequelize, Sequelize) => {
    const Situacao = sequelize.define("corretoras_commissions_situacoes", {
        nome: {
            type: Sequelize.STRING
        },
        descricao: {
            type: Sequelize.STRING
        },
    });

    return Situacao;
};