module.exports = (sequelize, Sequelize) => {
    const Contato = sequelize.define("produtores_contato", {
        email: {
            type: Sequelize.STRING
        },
        telefone: {
            type: Sequelize.STRING
        },
        whatsapp: {
            type: Sequelize.STRING
        },
    });

    return Contato;
};