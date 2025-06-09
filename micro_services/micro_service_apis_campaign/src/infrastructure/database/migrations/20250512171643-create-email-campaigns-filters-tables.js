'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. SCHEDULE
    await queryInterface.createTable('cliente_campanha_email_schedules', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      scheduleDate: {
        type: Sequelize.DATE,
        allowNull: false
      },
      periodicity: {
        type: Sequelize.ENUM('ONE', 'WEEKLY', 'MONTHLY'),
        allowNull: false
      },
      emailCampaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cliente_campanha_email_campaigns',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    });

    // 2. VALIDITY
    await queryInterface.createTable('cliente_campanha_email_validity', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      start: {
        type: Sequelize.DATE,
        allowNull: false
      },
      end: {
        type: Sequelize.DATE,
        allowNull: false
      },
      emailCampaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cliente_campanha_email_campaigns',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    });

    // 3. AGE RANGE
    await queryInterface.createTable('cliente_campanha_email_age_ranges', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      min: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      max: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      emailCampaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cliente_campanha_email_campaigns',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('cliente_campanha_email_age_ranges');
    await queryInterface.dropTable('cliente_campanha_email_validity');
    await queryInterface.dropTable('cliente_campanha_email_schedules');
  }
};
