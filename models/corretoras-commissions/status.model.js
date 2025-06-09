module.exports = (sequelize, Sequelize) => {
    const Status = sequelize.define("corretoras_commissions_statu", {
        nome: {
            type: Sequelize.STRING
        },
        descricao: {
            type: Sequelize.STRING
        },
    });

    return Status;
};