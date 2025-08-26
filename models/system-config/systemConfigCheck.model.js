module.exports = (sequelize, Sequelize) => {
    const SystemConfigCheck = sequelize.define("system_config_checks", {
        nome: {
            type: Sequelize.STRING
        },
        descricao: {
            type: Sequelize.STRING
        },
        checked: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
        }
    });

    return SystemConfigCheck;
};