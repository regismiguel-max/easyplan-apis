'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Criar índice em codigo_produto na tabela de operadoras
    await queryInterface.addIndex('cliente_digital_operadoras', ['codigo_produto'], {
      name: 'idx_codigo_produto'
    });

    // 2. Recriar a coluna operatorId como STRING com FK para codigo_produto
    await queryInterface.addColumn('cliente_campanha_email_operators', 'operatorId', {
      type: Sequelize.STRING,
      allowNull: false,
      references: {
        model: 'cliente_digital_operadoras',
        key: 'codigo_produto'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // 1. Remover a nova coluna
    await queryInterface.removeColumn('cliente_campanha_email_operators', 'operatorId');

    // 2. Remover o índice criado
    await queryInterface.removeIndex('cliente_digital_operadoras', 'idx_codigo_produto');
  }
};
