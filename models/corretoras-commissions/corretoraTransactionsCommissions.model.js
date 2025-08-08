module.exports = (sequelize, Sequelize) => {
    const Transactions = sequelize.define("corretora_commissions_transactions", {
        corretoraCNPJ: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        corretoraRazaoSocial: {
            type: Sequelize.STRING
        },
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
        idLoteCommissions: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        idSubLoteCommissions: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        idCommissions: {
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
        codigoCommissionDigitalSaude: {
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
