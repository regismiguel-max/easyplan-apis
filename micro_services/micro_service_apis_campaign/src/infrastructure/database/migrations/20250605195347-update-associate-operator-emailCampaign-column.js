'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.renameColumn(
      'cliente_campanha_campaign_operators',
      'emailCampaignId',
      'campaignId'
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.renameColumn(
      'cliente_campanha_campaign_operators',
      'campaignId',
      'emailCampaignId'
    );
  }
};
