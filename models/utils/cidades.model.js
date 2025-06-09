module.exports = (sequelize, Sequelize) => {
    const Cidades = sequelize.define("utils_cidade", {
        cidadeID: {
            type: Sequelize.INTEGER,
            primaryKey: true
        },
        cidadeNome: {
            type: Sequelize.STRING
        },
        estadoID: {
            type: Sequelize.INTEGER
        },
        estadoNome: {
            type: Sequelize.STRING
        },
    });

    return Cidades;
};