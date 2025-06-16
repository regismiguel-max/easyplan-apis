'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.renameColumn(
      'cliente_campanha_campaign_age_ranges',
      'emailCampaignId',
      'campaignId'
    );
    await queryInterface.renameColumn(
      'cliente_campanha_campaign_validity',
      'emailCampaignId',
      'campaignId'
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.renameColumn(
      'cliente_campanha_campaign_age_ranges',
      'campaignId',
      'emailCampaignId'
    );
    await queryInterface.renameColumn(
      'cliente_campanha_campaign_validity',
      'campaignId',
      'emailCampaignId'
    );
  }
};
