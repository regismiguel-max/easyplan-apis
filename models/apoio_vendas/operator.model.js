module.exports = (sequelize, Sequelize) => {
    const Operator = sequelize.define("operators", {
        name: {
            type: Sequelize.STRING
        },
        descricao: {
            type: Sequelize.STRING
        },
        idPai: {
            type: Sequelize.STRING
        },
        pasta: {
            type: Sequelize.BOOLEAN
        }
    });

    return Operator;
};