module.exports = (sequelize, Sequelize) => {
    const SwilePayment = sequelize.define("swile_payments", {
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
        user_whatsapp: {
            type: Sequelize.STRING
        },
        user_email: {
            type: Sequelize.STRING
        },
        code: {
            type: Sequelize.STRING
        },
        authenticated: {
            type: Sequelize.BOOLEAN
        },
        request_ID: {
            type: Sequelize.STRING
        },
        lote_ID: {
            type: Sequelize.STRING
        },
        lote_type: {
            type: Sequelize.STRING
        },
        lote_quantidade: {
            type: Sequelize.STRING
        },
        lote_totalBonificacoes: {
            type: Sequelize.STRING
        },
        lote_previsao: {
            type: Sequelize.STRING
        },
        lote_solicitacaoPagamento: {
            type: Sequelize.STRING
        },
        lote_dataPagamento: {
            type: Sequelize.STRING
        },
        payment_status_ID: {
            type: Sequelize.STRING
        },
        payment_status: {
            type: Sequelize.STRING
        },
        payment_descricao: {
            type: Sequelize.JSON
        },
        swile_summaryId: {
            type: Sequelize.STRING
        },
        swile_orderGroupId: {
            type: Sequelize.STRING
        },
        swile_orderGroupCode: {
            type: Sequelize.STRING
        },
        swile_externalId: {
            type: Sequelize.STRING
        },
        swile_status: {
            type: Sequelize.STRING
        },
        swile_rejectReason: {
            type: Sequelize.STRING
        },
        wallet_quantidade: {
            type: Sequelize.STRING
        },
        wallet_totalBonificacoes: {
            type: Sequelize.STRING
        },
    });

    return SwilePayment;
};