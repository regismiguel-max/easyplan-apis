'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addConstraint('cliente_digital_operadoras', {
      fields: ['codigo_produto'],
      type: 'unique',
      name: 'unique_codigo_produto_constraint'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint('cliente_digital_operadoras', 'unique_codigo_produto_constraint');
  }
};
