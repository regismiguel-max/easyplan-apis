module.exports = (sequelize, Sequelize) => {
    const ResponsavelDocumento = sequelize.define("corretoras_responsavel_documento", {
        documento_URL: {
            type: Sequelize.STRING
        },
    });

    return ResponsavelDocumento;
};