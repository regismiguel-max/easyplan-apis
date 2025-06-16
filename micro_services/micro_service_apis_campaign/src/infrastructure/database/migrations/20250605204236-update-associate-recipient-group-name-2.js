'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'cliente_campanha_email_recipient_group',
      'cliente_campanha_campaign_recipient_group'
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'cliente_campanha_campaign_recipient_group',
      'cliente_campanha_email_recipient_group'
    );
  }
};
