'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Remover coluna antiga
    await queryInterface.removeColumn('campaign_message_statuses', 'idsStatus');

    // Adicionar novas colunas normalizadas
    await queryInterface.addColumn('campaign_message_statuses', 'number', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    await queryInterface.addColumn('campaign_message_statuses', 'idMessage', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    await queryInterface.addColumn('campaign_message_statuses', 'chunkIndex', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('campaign_message_statuses', 'status', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.addColumn('campaign_message_statuses', 'idsStatus', {
      type: Sequelize.JSON,
      allowNull: false,
    });

    await queryInterface.removeColumn('campaign_message_statuses', 'number');
    await queryInterface.removeColumn('campaign_message_statuses', 'idMessage');
    await queryInterface.removeColumn('campaign_message_statuses', 'chunkIndex');
    await queryInterface.removeColumn('campaign_message_statuses', 'status');
  }
};
