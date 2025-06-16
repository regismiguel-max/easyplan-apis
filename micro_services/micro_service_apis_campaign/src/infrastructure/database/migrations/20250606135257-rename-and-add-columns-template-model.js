'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('cliente_campanha_campaign_templates', 'typeTemplate', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.renameColumn(
      'cliente_campanha_campaign_templates',
      'absolutePath',
      'templateContent'
    )
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('cliente_campanha_campaign_templates', 'typeTemplate');

    await queryInterface.renameColumn(
      'cliente_campanha_campaign_templates',
      'templateContent',
      'absolutePath'
    );
  }
};
