module.exports = (sequelize, Sequelize) => {
    const Wallets = sequelize.define("produtor_wallets_bonuse", {
        produtorCPF: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        produtorNome: {
            type: Sequelize.STRING
        },
        saldoAtual: {
            type: Sequelize.DECIMAL(10, 2),
            defaultValue: 0
        },
        saldoProvisionado: {
            type: Sequelize.DECIMAL(10, 2),
            defaultValue: 0
        },
        saldoDisponivel: {
            type: Sequelize.DECIMAL(10, 2),
            defaultValue: 0
        },
        ativa: {
            type: Sequelize.BOOLEAN,
            defaultValue: true
        },
    });

    return Wallets;
};
