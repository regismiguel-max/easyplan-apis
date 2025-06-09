module.exports = (sequelize, Sequelize) => {
    const TwoFactorAuthentication = sequelize.define("corretoras_two_factor_authentication", {
        cnpj: {
            type: Sequelize.STRING
        },
        whatsapp: {
            type: Sequelize.STRING
        },
        code: {
            type: Sequelize.STRING
        },
        validity: {
            type: Sequelize.STRING
        },
        authenticated: {
            type: Sequelize.BOOLEAN
        },

    });

    return TwoFactorAuthentication;
};