module.exports = (sequelize, Sequelize) => {
    const Push_logs = sequelize.define("app_clientes_push_logs", {
        user_id: {
            type: Sequelize.STRING,
            allowNull: false
        },
        player_id: {
            type: Sequelize.STRING,
            allowNull: false
        },
        tipo: {
            type: Sequelize.ENUM(
                'emitido_inicial',
                'emitido_vencimento',
                'vencido_4dias',
                'vencido_recorrente'
            ),
            allowNull: false
        },
        data_envio: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW
        },
        fatura_codigo: {
            type: Sequelize.STRING
        },
        fatura_url: {
            type: Sequelize.TEXT
        },
        mensagem: {
            type: Sequelize.TEXT
        },
        status: {
            type: Sequelize.STRING
        },
        dias_vencido: {
            type: Sequelize.INTEGER,
            allowNull: true
        }
    }, {
        indexes: [
            { fields: ['user_id'] },
            { fields: ['fatura_codigo'] },
            { fields: ['tipo'] },
            {
                name: 'idx_push_logs_composto', // ✅ nome curto e funcional
                unique: false,
                fields: ['user_id', 'player_id', 'fatura_codigo', 'tipo', 'dias_vencido']
            }
        ]
    });

    return Push_logs;
};