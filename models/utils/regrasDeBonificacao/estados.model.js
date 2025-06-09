module.exports = (sequelize, Sequelize) => {
    const Estados = sequelize.define("utils_regras_de_bonificacao_estado", {
        estadoID: {
            type: Sequelize.STRING,
        },
        estadoNome: {
            type: Sequelize.STRING
        },
        estadoUF: {
            type: Sequelize.STRING
        },
    });

    return Estados;
};