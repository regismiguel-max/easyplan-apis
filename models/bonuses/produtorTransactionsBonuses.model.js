module.exports = (sequelize, Sequelize) => {
    const Transactions = sequelize.define("produtor_transactions_bonuse", {
        produtorCPF: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        produtorNome: {
            type: Sequelize.STRING
        },
        clienteNome: {
            type: Sequelize.STRING
        },
        valor: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false,
        },
        tipo: {
            type: Sequelize.ENUM('credito', 'debito'),
            allowNull: false,
        },
        descricao: {
            type: Sequelize.TEXT,
        },
        idLoteBonuses: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        idBonuses: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        dataLancamento: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        vigencia: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        numeroParcela: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        codigoBonusesDigitalSaude: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        codigoProduto: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        nomeProduto: {
            type: Sequelize.STRING
        },
        calculated: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        }
    });

    return Transactions;
};
