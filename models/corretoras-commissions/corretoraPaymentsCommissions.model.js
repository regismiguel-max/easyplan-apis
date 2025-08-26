module.exports = (sequelize, Sequelize) => {
    const Payments = sequelize.define("corretora_commissions_payments", {
        walletID: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        corretoraCNPJ: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        valor: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
        },
        idLoteCommissions: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        idSubLoteCommissions: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        status: {
            type: Sequelize.ENUM('provisionado', 'confirmado', 'cancelado'),
            defaultValue: 'provisionado',
            allowNull: false,
        }
    });

    return Payments;
};
