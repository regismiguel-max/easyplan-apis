module.exports = (sequelize, Sequelize) => {
    const Operator = sequelize.define("cliente_digital_operadoras", {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        nome_operadora: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        cnpj_operadora: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        codigo_produto: {
            type: Sequelize.STRING,
            unique: true,
            allowNull: false,
        },
    }, {
        timestamps: true
    });

    return Operator;
};
