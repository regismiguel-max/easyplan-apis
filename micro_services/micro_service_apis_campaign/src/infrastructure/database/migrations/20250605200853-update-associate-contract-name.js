'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'cliente_campanha_email_contract_statuses',
      'cliente_campanha_campaign_contract_statuses'
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'cliente_campanha_campaign_contract_statuses',
      'cliente_campanha_email_contract_statuses'
    );
  }
};
