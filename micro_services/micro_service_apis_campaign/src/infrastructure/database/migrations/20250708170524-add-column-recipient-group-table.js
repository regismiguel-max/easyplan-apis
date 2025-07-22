'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
     await queryInterface.addColumn(
          'cliente_campanha_campaign_recipient_group',
          'operadora',
          {
            type: Sequelize.STRING,
            allowNull: true,
          }
        )
        await queryInterface.addColumn(
          'cliente_campanha_campaign_recipient_group',
          'plano',
          {
            type: Sequelize.STRING,
            allowNull: true,
          }
        )
        await queryInterface.addColumn(
          'cliente_campanha_campaign_recipient_group',
          'status_do_beneficiario',
          {
            type: Sequelize.STRING,
            allowNull: true,
          }
        )
        await queryInterface.addColumn(
          'cliente_campanha_campaign_recipient_group',
          'uf',
          {
            type: Sequelize.STRING,
            allowNull: true,
          }
        )
        await queryInterface.addColumn(
          'cliente_campanha_campaign_recipient_group',
          'sexo',
          {
            type: Sequelize.STRING,
            allowNull: true,
          }
        )
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeColumn(
      'cliente_campanha_campaign_recipient_group',
      'operadora'
    )
    await queryInterface.removeColumn(
      'cliente_campanha_campaign_recipient_group',
      'plano'
    )
    await queryInterface.removeColumn(
      'cliente_campanha_campaign_recipient_group',
      'status_do_beneficiario'
    )
    await queryInterface.removeColumn(
      'cliente_campanha_campaign_recipient_group',
      'uf'
    )
    await queryInterface.removeColumn(
      'cliente_campanha_campaign_recipient_group',
      'sexo'
    )
  }
};
