'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.changeColumn('cliente_campanha_campaign_message_statuses', 'number', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.changeColumn('cliente_campanha_campaign_message_statuses', 'number', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  }
};
