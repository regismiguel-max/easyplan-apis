module.exports = (sequelize, Sequelize) => {
    const DadosAcesso = sequelize.define("produtores_dados_acesso", {
        cpf: {
            type: Sequelize.STRING
        },
        password: {
            type: Sequelize.STRING
        },
    });

    return DadosAcesso;
};