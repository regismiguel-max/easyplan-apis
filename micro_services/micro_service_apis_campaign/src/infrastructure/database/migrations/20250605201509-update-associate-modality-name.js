'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'cliente_campanha_email_modalities',
      'cliente_campanha_campaign_modalities'
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'cliente_campanha_campaign_modalities',
      'cliente_campanha_email_modalities'
    );
  }
};
