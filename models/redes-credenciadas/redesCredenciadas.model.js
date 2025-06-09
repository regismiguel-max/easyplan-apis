module.exports = (sequelize, Sequelize) => {
    const RedesCredenciadas = sequelize.define("app_clientes_redes_credenciadas", {
        operadora_ID: {
            type: Sequelize.STRING
        },
        operadora: {
            type: Sequelize.STRING
        },
        produto_ID: {
            type: Sequelize.STRING
        },
        produto: {
            type: Sequelize.STRING
        },
        prestador_tipo_ID: {
            type: Sequelize.STRING
        },
        prestador_tipo: {
            type: Sequelize.STRING
        },
        prestador: {
            type: Sequelize.STRING
        },
        uf_ID: {
            type: Sequelize.STRING
        },
        uf: {
            type: Sequelize.STRING
        },
        municipio_ID: {
            type: Sequelize.STRING
        },
        municipio: {
            type: Sequelize.STRING
        },
        logradouro: {
            type: Sequelize.STRING
        },
        bairro: {
            type: Sequelize.STRING
        },
        numero: {
            type: Sequelize.STRING
        },
        latitude: {
            type: Sequelize.STRING
        },
        longitude: {
            type: Sequelize.STRING
        },
        especialidade_ID: {
            type: Sequelize.STRING
        },
        especialidade: {
            type: Sequelize.STRING
        },
        arquivo_url: {
            type: Sequelize.STRING
        },
        disabled: {
            type: Sequelize.BOOLEAN
        },
    });

    return RedesCredenciadas;
};