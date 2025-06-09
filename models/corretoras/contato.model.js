module.exports = (sequelize, Sequelize) => {
    const Contato = sequelize.define("corretoras_contato", {
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