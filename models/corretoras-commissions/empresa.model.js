module.exports = (sequelize, Sequelize) => {
    const Situacao = sequelize.define("corretoras_commissions_empresas", {
        razao_social: {
            type: Sequelize.STRING
        },
        cnpj: {
            type: Sequelize.STRING
        },
        ie: {
            type: Sequelize.STRING
        },
        endereco: {
            type: Sequelize.STRING
        },
        bairro: {
            type: Sequelize.STRING
        },
        cep: {
            type: Sequelize.STRING
        },
    });

    return Situacao;
};