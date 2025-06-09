module.exports = (sequelize, Sequelize) => {
    const Estados = sequelize.define("utils_vigencia_e_fechamento_estado", {
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