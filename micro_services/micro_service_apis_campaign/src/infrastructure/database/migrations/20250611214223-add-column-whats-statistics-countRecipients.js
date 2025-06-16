'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('cliente_campanha_statistics_whats_campaigns', 'countsRecipients', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('cliente_campanha_statistics_whats_campaigns', 'countsRecipients');
  }
};
