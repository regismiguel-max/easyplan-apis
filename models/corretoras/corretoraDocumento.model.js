module.exports = (sequelize, Sequelize) => {
    const CorretoraDocumento = sequelize.define("corretoras_documento", {
        documento_URL: {
            type: Sequelize.STRING
        },
    });

    return CorretoraDocumento;
};