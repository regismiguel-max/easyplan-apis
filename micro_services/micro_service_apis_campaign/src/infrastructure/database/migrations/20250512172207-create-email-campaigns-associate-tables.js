'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // OPERATORS
    await queryInterface.createTable('cliente_campanha_email_operators', {
      emailCampaignId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'cliente_campanha_email_campaigns',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      operatorId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'cliente_digital_operadoras', // <- nome da tabela real
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    });

    // PLANS
    await queryInterface.createTable('cliente_campanha_email_plans', {
      emailCampaignId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'cliente_campanha_email_campaigns',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      planId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'cliente_digital_planos', // <- nome da tabela real
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    });

    // MODALITY
    await queryInterface.createTable('cliente_campanha_email_modalities', {
      emailCampaignId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'cliente_campanha_email_campaigns',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      modalityId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'cliente_digital_modalidades',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    });

    // CONTRACT STATUS
    await queryInterface.createTable('cliente_campanha_email_contract_statuses', {
      emailCampaignId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'cliente_campanha_email_campaigns',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      contractStatusId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'cliente_digital_status', // <== nome real da tabela
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
      // Optional: garantir unicidade via índice
      // unique: ['emailCampaignId', 'contractStatusId']
    });

    // UF
    await queryInterface.createTable('cliente_campanha_email_ufs', {
      emailCampaignId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'cliente_campanha_email_campaigns',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      ufId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'utils_estados',
          key: 'estadoID'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('cliente_campanha_email_ufs');
    await queryInterface.dropTable('cliente_campanha_email_contract_statuses');
    await queryInterface.dropTable('cliente_campanha_email_modalities');
    await queryInterface.dropTable('cliente_campanha_email_plans');
    await queryInterface.dropTable('cliente_campanha_email_operators');
  }
};
