module.exports = (sequelize, Sequelize) => {
    const ProdutoresDocumento = sequelize.define("produtores_documento", {
        documento_URL: {
            type: Sequelize.STRING
        },
    });

    return ProdutoresDocumento;
};