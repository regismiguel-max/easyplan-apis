module.exports = (sequelize, Sequelize) => {
    const Produtores = sequelize.define("produtores", {
        cpf: {
            type: Sequelize.STRING
        },
        nome: {
            type: Sequelize.STRING
        },
        documento_ID: {
            type: Sequelize.STRING
        },
        dados_acesso_ID: {
            type: Sequelize.STRING
        },
        contato_ID: {
            type: Sequelize.STRING
        },
        endereco_ID: {
            type: Sequelize.STRING
        },
        situacao_ID: {
            type: Sequelize.STRING
        },
        is_supervisor: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        },
    });

    return Produtores;
};
