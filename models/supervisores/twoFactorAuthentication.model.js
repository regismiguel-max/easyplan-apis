module.exports = (sequelize, Sequelize) => {
    const TwoFactorAuthentication = sequelize.define("app_supervisores_two_factor_authentication", {
        documento: {
            type: Sequelize.STRING
        },
        whatsapp: {
            type: Sequelize.STRING
        },
        email: {
            type: Sequelize.STRING
        },
        code: {
            type: Sequelize.STRING
        },
        authenticated: {
            type: Sequelize.BOOLEAN
        },
    });

    return TwoFactorAuthentication;
};