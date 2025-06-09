module.exports = (sequelize, Sequelize) => {
    const Contatos = sequelize.define("app_clientes_contatos", {
        name: {
            type: Sequelize.STRING
        },
        canal: {
            type: Sequelize.STRING
        },
        location: {
            type: Sequelize.STRING
        },
        telefone: {
            type: Sequelize.STRING
        },
        email: {
            type: Sequelize.STRING
        },
        codigo: {
            type: Sequelize.STRING
        },
        descricao: {
            type: Sequelize.STRING
        },
        obs: {
            type: Sequelize.STRING
        },
    });

    return Contatos;
};