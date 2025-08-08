module.exports = (sequelize, Sequelize) => {
    const NFDocumento = sequelize.define("corretoras_commissions_nfs", {
        documento_URL: {
            type: Sequelize.STRING
        },
        situacao_ID: {
            type: Sequelize.STRING
        },
        motivo: {
            type: Sequelize.STRING
        },
        valor_liquido: {
            type: Sequelize.STRING
        },
        data_emissao: {
            type: Sequelize.STRING
        },
        numero_NF: {
            type: Sequelize.STRING
        },
        validated: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        }
    });

    return NFDocumento;
};