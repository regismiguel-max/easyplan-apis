module.exports = (sequelize, Sequelize) => {
    const PrestadorTipo = sequelize.define("app_clientes_redes_credenciadas_prestador_tipos", {
        prestador_tipo: {
            type: Sequelize.STRING
        },
    });

    return PrestadorTipo;
};