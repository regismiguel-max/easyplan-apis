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
          'cliente_campanha_campaigns',
          'filterByDay',
          {
            type: Sequelize.BOOLEAN,
            allowNull: true,
          }
        )
        await queryInterface.addColumn(
          'cliente_campanha_campaigns',
          'filterByMonth',
          {
            type: Sequelize.BOOLEAN,
            allowNull: true,
          }
        )
        await queryInterface.addColumn(
          'cliente_campanha_campaigns',
          'filterByYear',
          {
            type: Sequelize.BOOLEAN,
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
      'cliente_campanha_campaigns',
      'filterByDay'
    )
    await queryInterface.removeColumn(
      'cliente_campanha_campaigns',
      'filterByMonth'
    )
    await queryInterface.removeColumn(
      'cliente_campanha_campaigns',
      'filterByYear'
    )
  }
};
