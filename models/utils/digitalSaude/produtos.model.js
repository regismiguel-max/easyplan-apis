module.exports = (sequelize, Sequelize) => {
    const Produtos = sequelize.define("utils_digital_saude_produto", {
        codigo: {
            type: Sequelize.STRING
        },
        nome: {
            type: Sequelize.STRING
        },
        status: {
            type: Sequelize.STRING
        },
        regiao: {
            type: Sequelize.STRING
        },
        registroANS: {
            type: Sequelize.STRING
        },
        acomodacao: {
            type: Sequelize.STRING
        },
        abrangencia: {
            type: Sequelize.STRING
        },
        coparticipacao: {
            type: Sequelize.STRING
        },
        integracaoDoPlano: {
            type: Sequelize.STRING
        },
    });

    return Produtos;
};