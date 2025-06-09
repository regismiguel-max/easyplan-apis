module.exports = (sequelize, Sequelize) => {
    const TwoFactorAuthentication = sequelize.define("produtores_two_factor_authentication", {
        cpf: {
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