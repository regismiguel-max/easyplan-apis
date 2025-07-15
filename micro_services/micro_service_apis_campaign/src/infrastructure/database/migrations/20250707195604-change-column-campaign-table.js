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
    await queryInterface.changeColumn('cliente_campanha_campaigns', 'filterByDay', {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false})
    await queryInterface.changeColumn('cliente_campanha_campaigns', 'filterByMonth', {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false})
    await queryInterface.changeColumn('cliente_campanha_campaigns', 'filterByYear', {type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false})
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.changeColumn('cliente_campanha_campaigns', 'filterByDay', {type: Sequelize.BOOLEAN, allowNull: true})
    await queryInterface.changeColumn('cliente_campanha_campaigns', 'filterByMonth', {type: Sequelize.BOOLEAN, allowNull: true})
    await queryInterface.changeColumn('cliente_campanha_campaigns', 'filterByYear', {type: Sequelize.BOOLEAN, allowNull: true})
  }
};
