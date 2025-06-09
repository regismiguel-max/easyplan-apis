module.exports = (sequelize, Sequelize) => {
    const Especialidade = sequelize.define("app_clientes_redes_credenciadas_especialidades", {
        especialidade: {
            type: Sequelize.STRING
        },
    });

    return Especialidade;
};