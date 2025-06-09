module.exports = (sequelize, Sequelize) => {
    const Payments = sequelize.define("produtor_payments_bonuse", {
        walletID: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        produtorCPF: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        valor: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
        },
        idLoteBonuses: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        // idBonuses: {
        //     type: Sequelize.STRING,
        //     allowNull: false,
        // },
        // codigoBonusesDigitalSaude: {
        //     type: Sequelize.STRING,
        //     allowNull: false,
        // },
        status : {
            type: Sequelize.ENUM('provisionado', 'confirmado', 'cancelado'),
            defaultValue: 'provisionado',
            allowNull: false,
        }
    });

    return Payments;
};
