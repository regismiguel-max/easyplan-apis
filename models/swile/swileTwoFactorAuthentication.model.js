module.exports = (sequelize, Sequelize) => {
    const SwileTwoFactorAuthentication = sequelize.define("swile_two_factor_authentication", {
        user_ID: {
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
        request_ID: {
            type: Sequelize.STRING
        },
        authenticated: {
            type: Sequelize.BOOLEAN
        },

    });

    return SwileTwoFactorAuthentication;
};