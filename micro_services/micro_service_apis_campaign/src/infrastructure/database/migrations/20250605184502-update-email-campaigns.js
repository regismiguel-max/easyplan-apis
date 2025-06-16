'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 1. Renomear a tabela
    await queryInterface.renameTable(
      'cliente_campanha_email_campaigns',
      'cliente_campanha_campaigns'
    );

    // 2. Adicionar coluna 'type_campaign'
    await queryInterface.addColumn('cliente_campanha_campaigns', 'type_campaign', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    // 3. Tornar o campo 'subject' opcional
    await queryInterface.changeColumn('cliente_campanha_campaigns', 'subject', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // 4. Renomear a coluna 'emailTemplateId' para 'templateId'
    await queryInterface.renameColumn(
      'cliente_campanha_campaigns',
      'emailTemplateId',
      'templateId'
    );
  },

  async down (queryInterface, Sequelize) {
   // Desfazendo as alterações na ordem inversa

    // 4. Renomear a coluna 'templateId' de volta para 'emailTemplateId'
    await queryInterface.renameColumn(
      'cliente_campanha_campaigns',
      'templateId',
      'emailTemplateId'
    );

    // 3. Tornar o campo 'subject' obrigatório novamente
    await queryInterface.changeColumn('cliente_campanha_campaigns', 'subject', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    // 2. Remover coluna 'type_campaign'
    await queryInterface.removeColumn('cliente_campanha_campaigns', 'type_campaign');

    // 1. Renomear a tabela de volta
    await queryInterface.renameTable(
      'cliente_campanha_campaigns',
      'cliente_campanha_email_campaigns'
    );
  }
};
