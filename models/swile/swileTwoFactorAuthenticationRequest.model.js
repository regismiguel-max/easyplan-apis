module.exports = (sequelize, Sequelize) => {
    const SwileTwoFactorAuthenticationRequest = sequelize.define("swile_two_factor_authentication_request", {
        user_ID: {
            type: Sequelize.STRING
        },
        user_IP: {
            type: Sequelize.STRING
        },
        user_lat: {
            type: Sequelize.STRING
        },
        user_lng: {
            type: Sequelize.STRING
        },
        user_endereco: {
            type: Sequelize.STRING
        },
        lote_ID: {
            type: Sequelize.STRING
        },
        lote_type: {
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
        lotePay: {
            type: Sequelize.JSON
        },
        authenticated: {
            type: Sequelize.BOOLEAN
        },
    });

    return SwileTwoFactorAuthenticationRequest;
};