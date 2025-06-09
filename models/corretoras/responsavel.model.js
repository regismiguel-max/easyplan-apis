module.exports = (sequelize, Sequelize) => {
    const Responsavel = sequelize.define("corretoras_responsavel", {
        nome: {
            type: Sequelize.STRING
        },
        documento_CPF: {
            type: Sequelize.STRING
        },
        documento_RG: {
            type: Sequelize.STRING
        },
        documento_SSP: {
            type: Sequelize.STRING
        },
        documento_ID: {
            type: Sequelize.STRING
        },
    });

    return Responsavel;
};