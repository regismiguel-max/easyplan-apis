module.exports = (sequelize, Sequelize) => {
    const Operadora = sequelize.define("utils_digital_saude_operadora", {
        codigo: {
            type: Sequelize.STRING
        },
        nome: {
            type: Sequelize.STRING
        },
        nomeTipo: {
            type: Sequelize.STRING
        },
    });

    return Operadora;
};