module.exports = (sequelize, Sequelize) => {
    const Supervisor = sequelize.define("corretoras_supervisor", {
        nome: {
            type: Sequelize.STRING
        },
        cpf: {
            type: Sequelize.STRING
        },
        email: {
            type: Sequelize.STRING
        },
        telefone: {
            type: Sequelize.STRING
        }
    });

    return Supervisor;
};