module.exports = (sequelize, Sequelize) => {
    const UserClient = sequelize.define("app_clientes_users", {
        adesaoID: {
            type: Sequelize.STRING
        },
        apolice: {
            type: Sequelize.STRING
        },
        birth_date: {
            type: Sequelize.STRING
        },
        cnpj: {
            type: Sequelize.STRING
        },
        contratoID: {
            type: Sequelize.STRING
        },
        cpf: {
            type: Sequelize.STRING
        },
        email: {
            type: Sequelize.STRING
        },
        name: {
            type: Sequelize.STRING
        },
        password: {
            type: Sequelize.STRING
        },
        telefone: {
            type: Sequelize.STRING
        },
        token: {
            type: Sequelize.STRING
        }
    });

    return UserClient;
};