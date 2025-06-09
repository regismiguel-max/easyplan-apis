module.exports = (sequelize, Sequelize) => {
    const Banco = sequelize.define("utils_banco", {
        bancoID: {
            type: Sequelize.STRING,
            primaryKey: true
        },
        nome: {
            type: Sequelize.STRING
        },
        codigo: {
            type: Sequelize.STRING
        },
        tipoObjetoID: {
            type: Sequelize.STRING
        },
    });

    return Banco;
};