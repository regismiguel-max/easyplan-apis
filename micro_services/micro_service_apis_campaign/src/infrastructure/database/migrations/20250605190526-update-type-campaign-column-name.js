'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.renameColumn(
      'cliente_campanha_campaigns',
      'type_campaign',
      'typeCampaign'
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.renameColumn(
      'cliente_campanha_campaigns',
      'typeCampaign',
      'type_campaign'
    );
  }
};
