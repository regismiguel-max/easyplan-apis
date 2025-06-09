module.exports = (sequelize, Sequelize) => {
    const Modalidade = sequelize.define("corretoras_commissions_modalidades", {
        id: {
            type: Sequelize.STRING,
            primaryKey: true
        },
        nome: {
            type: Sequelize.STRING
        },
    });

    return Modalidade;
};