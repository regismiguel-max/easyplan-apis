'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable("cliente_campanha_email_recipient_group", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ddd_celular: {
        type: Sequelize.STRING,
        allowNull: true
      },
      celular: {
        type: Sequelize.STRING,
        allowNull: true
      },
      email_principal: {
        type: Sequelize.STRING,
        allowNull: true
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

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable("cliente_campanha_email_recipient_group");
  }
};
