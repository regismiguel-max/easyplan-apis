module.exports = (sequelize, Sequelize) => {
    const Push_diversos_logs = sequelize.define("app_clientes_push_diversos_logs", {
        user_id: {
            type: Sequelize.STRING,
            allowNull: false
        },
        player_id: {
            type: Sequelize.STRING,
            allowNull: false
        },
        data_envio: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW
        },
        mensagem: {
            type: Sequelize.TEXT
        }
    }, {
        indexes: [
            { fields: ['user_id'] },
            { fields: ['player_id'] },
            {
                unique: false,
                fields: ['user_id', 'player_id']
            }
        ]
    });

    return Push_diversos_logs;
};