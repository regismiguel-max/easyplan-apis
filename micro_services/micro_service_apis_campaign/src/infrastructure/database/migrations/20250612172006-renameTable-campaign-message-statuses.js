'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.renameTable('campaign_message_statuses', 'cliente_campanha_campaign_message_statuses');
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.renameTable('cliente_campanha_campaign_message_statuses', 'campaign_message_statuses');
  }
};
