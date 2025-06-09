'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Adicionar novamente a coluna operatorId referenciando id (INT)
    await queryInterface.addColumn('cliente_campanha_email_operators', 'operatorId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'cliente_digital_operadoras',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Volta para a versão anterior com código_produto (caso precise reverter)
    await queryInterface.removeColumn('cliente_campanha_email_operators', 'operatorId');
  }
};
