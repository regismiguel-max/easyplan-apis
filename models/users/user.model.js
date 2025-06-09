module.exports = (sequelize, Sequelize) => {
    const User = sequelize.define("users", {
        name: {
            type: Sequelize.STRING
        },
        cpf: {
            type: Sequelize.STRING
        },
        email: {
            type: Sequelize.STRING
        },
        celular: {
            type: Sequelize.STRING
        },
        password: {
            type: Sequelize.STRING
        },
        active: {
            type: Sequelize.BOOLEAN,
            defaultValue: true,
        },
        payment: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        },
        estadoID: {
            type: Sequelize.STRING
        },
    });

    return User;
};