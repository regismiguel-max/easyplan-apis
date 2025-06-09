module.exports = (sequelize, Sequelize) => {
    const Operadora = sequelize.define("app_clientes_redes_credenciadas_operadoras", {
        operadora: {
            type: Sequelize.STRING
        },
    });

    return Operadora;
};