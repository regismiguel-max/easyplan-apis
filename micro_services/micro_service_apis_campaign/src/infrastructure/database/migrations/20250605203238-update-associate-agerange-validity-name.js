'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'cliente_campanha_email_age_ranges',
      'cliente_campanha_campaign_age_ranges'
    );

    await queryInterface.renameTable(
      'cliente_campanha_email_validity',
      'cliente_campanha_campaign_validity'
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'cliente_campanha_campaign_age_ranges',
      'cliente_campanha_email_age_ranges'
    );
    await queryInterface.renameTable(
      'cliente_campanha_campaign_validity',
      'cliente_campanha_email_validity'
    );
  }
};
