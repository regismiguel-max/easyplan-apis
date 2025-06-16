'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'cliente_campanha_email_operators',
      'cliente_campanha_campaign_operators'
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'cliente_campanha_campaign_operators',
      'cliente_campanha_email_operators'
    );
  }
};
