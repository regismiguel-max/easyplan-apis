'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.changeColumn('cliente_campanha_email_campaigns', 'status', {
      type: Sequelize.ENUM(
        'DRAFT',
        'PENDING',
        'QUEUED',
        'PROCESSING',
        'SENT',
        'PARTIALLY_SENT',
        'FAILED',
        'CANCELLED'
      ),
      allowNull: false,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.changeColumn('cliente_campanha_email_campaigns', 'status', {
      type: Sequelize.ENUM(
        'DRAFT',
        'PENDING',
        'SENT',
        'FAILED'
      ),
      allowNull: false,
    });
  }
};
