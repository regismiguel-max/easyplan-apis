'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.removeColumn('cliente_campanha_email_campaigns', 'doSchedule')
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.addColumn('cliente_campanha_email_campaigns', 'doSchedule', {
      type: Sequelize.STRING,
      allowNull: true,
    })
  }
};
