module.exports = (sequelize, Sequelize) => {
    const DadosAcesso = sequelize.define("corretoras_dados_acesso", {
        cnpj: {
            type: Sequelize.STRING
        },
        password: {
            type: Sequelize.STRING
        },
    });

    return DadosAcesso;
};