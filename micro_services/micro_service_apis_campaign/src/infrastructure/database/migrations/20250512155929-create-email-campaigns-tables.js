"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable("cliente_campanha_email_templates", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      templateName: {
        type: Sequelize.STRING,
      },
      absolutePath: {
        type: Sequelize.STRING,
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
    
    await queryInterface.createTable("cliente_campanha_email_campaigns", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      campaignName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      subject: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("DRAFT", "PENDING", "SENT", "FAILED"),
        defaultValue: "DRAFT",
        allowNull: false,
      },
      emailTemplateId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'cliente_campanha_email_templates',
          key: "id",
        },
      },
      doSchedule: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      filterByAgeRange: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      filterByContractStatus: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      filterByModality: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      filterByOperator: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      filterByPlan: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      filterByUf: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      filterByValidity: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });

    await queryInterface.createTable(
      "cliente_campanha_statistics_email_campaigns",
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        emailCampaignId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'cliente_campanha_email_campaigns',
            key: "id",
          },
        },
        countsRecipients: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        processed: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        delivered: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        open: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        click: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        bounce: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        dropped: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        spam: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        unsubscribe: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        firstProcessedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        lastProcessedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        firstDeliveredAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        lastDeliveredAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        firstOpenAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        lastOpenAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        // Taxas calculadas
        deliveryRate: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0,
        },
        openRate: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0,
        },
        createdAt: Sequelize.DATE,
        updatedAt: Sequelize.DATE,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */

    await queryInterface.dropTable("cliente_campanha_email_campaigns");
    await queryInterface.dropTable("cliente_campanha_email_templates");
    await queryInterface.dropTable("cliente_campanha_statistics_email_campaigns");
  },
};
