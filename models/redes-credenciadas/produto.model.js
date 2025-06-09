module.exports = (sequelize, Sequelize) => {
    const Produto = sequelize.define("app_clientes_redes_credenciadas_produtos", {
        produto: {
            type: Sequelize.STRING
        },
    });

    return Produto;
};