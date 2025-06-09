module.exports = (sequelize, Sequelize) => {
    const DadosBancario = sequelize.define("corretoras_dados_bancario", {
        banco_ID: {
            type: Sequelize.STRING
        },
        agencia: {
            type: Sequelize.STRING
        },
        agencia_DV: {
            type: Sequelize.STRING
        },
        conta: {
            type: Sequelize.STRING
        },
        conta_DV: {
            type: Sequelize.STRING
        },
        chave_PIX: {
            type: Sequelize.STRING
        },
        tipo_conta_ID: {
            type: Sequelize.STRING
        },
    });

    return DadosBancario;
};