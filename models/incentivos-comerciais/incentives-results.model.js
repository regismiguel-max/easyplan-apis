module.exports = (sequelize, Sequelize) => {
    const IncentiveResult = sequelize.define('supervisores_incentivos_resultados', {
        incentive_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'supervisores_incentivos_comerciais',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        total_sales: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: '0'
        },
        implanted_total_sales: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: '0'
        },
        calculeted_bonus: {
            type: Sequelize.STRING,
            allowNull: true
        },
        calculeted_at: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
        }
    });

    return IncentiveResult
}