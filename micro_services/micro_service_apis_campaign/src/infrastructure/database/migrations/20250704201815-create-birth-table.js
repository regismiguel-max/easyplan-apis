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
    await queryInterface.createTable(
      'cliente_campanha_campaigns_birth',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        campaignId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'cliente_campanha_campaigns',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        day: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        month: {
          type: Sequelize.STRING,
          allowNull: true
        },
        year: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        createdAt: Sequelize.DATE,
        updatedAt: Sequelize.DATE
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
    await queryInterface.dropTable('cliente_campanha_campaigns_birth');
  }
};
