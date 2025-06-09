module.exports = (sequelize, Sequelize) => {
    const TipoContaBancaria = sequelize.define("utils_tipos_contas_bancarias", {
        tipoContaBancariaID: {
            type: Sequelize.STRING,
            primaryKey: true
        },
        nome: {
            type: Sequelize.STRING
        },
    });

    return TipoContaBancaria;
};