module.exports = (sequelize, Sequelize) => {
    const Estados = sequelize.define("utils_estado", {
        estadoID: {
            type: Sequelize.INTEGER,
            primaryKey: true
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