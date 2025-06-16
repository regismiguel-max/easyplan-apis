'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable("cliente_campanha_statistics_whats_campaigns", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      campaignId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cliente_campanha_campaigns',
          key: "id",
        },
      },
      sent: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      failed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      sentRate: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable("cliente_campanha_statistics_whats_campaigns");
  }
};
