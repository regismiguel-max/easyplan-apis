module.exports = (sequelize, Sequelize) => {
    const Endereco = sequelize.define("produtores_endereco", {
        estado_ID: {
            type: Sequelize.STRING
        },
        cidade_ID: {
            type: Sequelize.STRING
        },
        cep: {
            type: Sequelize.STRING
        },
        bairro: {
            type: Sequelize.STRING
        },
        rua: {
            type: Sequelize.STRING
        },
        numero: {
            type: Sequelize.STRING
        },
        complemento: {
            type: Sequelize.STRING
        },
    });

    return Endereco;
};