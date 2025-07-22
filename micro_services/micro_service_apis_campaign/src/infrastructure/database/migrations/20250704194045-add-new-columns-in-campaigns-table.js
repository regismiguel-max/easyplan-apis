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
      'filterByBirth',
      {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      }
    )
    await queryInterface.addColumn(
      'cliente_campanha_campaigns',
      'filterByGender',
      {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      }
    )
    await queryInterface.addColumn(
      'cliente_campanha_campaigns',
      'gender',
      {
        type: Sequelize.ENUM('Masculino', 'Feminino'),
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
      'filterByBirth'
    )
    await queryInterface.removeColumn(
      'cliente_campanha_campaigns',
      'filterByGender'
    )
    await queryInterface.removeColumn(
      'cliente_campanha_campaigns',
      'gender'
    )
  }
};
