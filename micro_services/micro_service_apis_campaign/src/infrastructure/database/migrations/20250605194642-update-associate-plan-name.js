'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'cliente_campanha_email_plans',
      'cliente_campanha_campaign_plans'
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'cliente_campanha_campaign_plans',
      'cliente_campanha_email_plans'
    );
  }
};
