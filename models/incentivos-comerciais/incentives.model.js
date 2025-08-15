const corretoraModel = require("../corretoras/corretora.model");

module.exports = (sequelize, Sequelize) => {
    const Incentives = sequelize.define("supervisores_incentivos_comerciais", {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        incentive_type: {
            type: Sequelize.STRING,
            allowNull: false
        },
        incentive_description: {
            type: Sequelize.STRING,
            allowNull: false
        },
        life_goal: {
            type: Sequelize.STRING,
            allowNull: true
        },
        start_challenge_date: {
            type: Sequelize.STRING,
            allowNull: true
        },
        end_challenge_date: {
            type: Sequelize.STRING,
            allowNull: true
        },
        payment_life: {
            type: Sequelize.STRING,
            allowNull: true
        },
        payment_challenge: {
            type: Sequelize.STRING,
            allowNull: true
        },
        award_date: {
            type: Sequelize.STRING,
            allowNull: true
        },
        payment_award: {
            type: Sequelize.STRING,
            allowNull: true
        },
        broker_name: {
            type: Sequelize.STRING,
            allowNull: true
        },
        broker_cpf: {
            type: Sequelize.STRING,
            allowNull: true
        },
        cnpj: {
            type: Sequelize.STRING
        },
        corretora_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'corretoras',
                key: 'id'
            }
        },
        status: {
            type: Sequelize.ENUM('Em breve', 'Em andamento', 'Encerrado'),
            allowNull: false,
            defaultValue: 'Em breve'
        },
        resultado_desafio: {
            type: Sequelize.ENUM('Atingiu', 'Não atingiu'),
            allowNull: true
        },
    });

    return Incentives;
};