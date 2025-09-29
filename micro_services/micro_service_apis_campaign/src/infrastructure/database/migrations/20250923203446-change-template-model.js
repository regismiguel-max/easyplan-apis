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
    await queryInterface.changeColumn(
      'cliente_campanha_campaign_templates',
      'templateContent',
      {
        type: Sequelize.TEXT('long'),
        allowNull: false,
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
    await queryInterface.changeColumn(
      'cliente_campanha_campaign_templates',
      'templateContent',
      {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      }
    )
  }
};
