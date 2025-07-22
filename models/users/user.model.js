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
        urlBI: {
            type: Sequelize.STRING
        },
        reportIdBI: {
            type: Sequelize.STRING
        },
        groupIdBI: {
            type: Sequelize.STRING
        },
        filtersBI: {
            type: Sequelize.JSON
        },
    });

    return User;
};