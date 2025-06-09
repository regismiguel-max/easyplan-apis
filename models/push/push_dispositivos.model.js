module.exports = (sequelize, Sequelize) => {
    const Push_dispositivos = sequelize.define("app_clientes_push_dispositivos", {
        user_id: {
            type: Sequelize.STRING,
            allowNull: true
        },
        player_id: {
            type: Sequelize.STRING,
            allowNull: false
        },
        is_logged_in: {
            type: Sequelize.BOOLEAN,
            defaultValue: false
        },
        device_uuid: {
            type: Sequelize.STRING
        },
        device_platform: {
            type: Sequelize.ENUM('android', 'ios'),
            allowNull: false
        }
    }, {
        indexes: [
            {
                fields: ['user_id']
            },
            {
                fields: ['player_id']
            }
        ]
    });

    return Push_dispositivos;
};