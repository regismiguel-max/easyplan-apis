// const corretoraModel = require("../corretoras/corretora.model");
module.exports = (sequelize, Sequelize) => {
    const Incentives_Propostas = sequelize.define("supervisores_incentivos_comerciais_propostas", {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        incentive_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'supervisores_incentivos_comerciais',
                key: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        },
        produto: {
            type: Sequelize.STRING
        },
        status: {
            type: Sequelize.STRING
        },
        data_assinatura: {
            type: Sequelize.DATE
        },
        data_criacao: {
            type: Sequelize.DATE
        },
        vendedor_cpf: {
            type: Sequelize.STRING
        },
        vendedor_nome: {
            type: Sequelize.STRING
        },
        corretora_cnpj: {
            type: Sequelize.STRING
        },
        corretora_nome: {
            type: Sequelize.STRING
        },
        contratante_nome: {
            type: Sequelize.STRING
        },
        contratante_email: {
            type: Sequelize.STRING
        },
        contratante_cpf: {
            type: Sequelize.STRING
        },
        uf: {
            type: Sequelize.STRING(2)
        },
        total_valor: {
            type: Sequelize.DECIMAL(10, 2)
        },
        operadora: {
            type: Sequelize.STRING
        },
        propostaID: {
            type: Sequelize.STRING
        },
        pagou: {
            type: Sequelize.BOOLEAN,
            allowNull: true
        },
        codigo_do_contrato: {
            type: Sequelize.STRING,
            allowNull: true
        },
        data_pagamento: {
            type: Sequelize.STRING,
            allowNull: true
        },
        beneficiarios: {
            type: Sequelize.INTEGER,
            allowNull: true
        },
        financeiro_pagou: {
            type: Sequelize.BOOLEAN,
            allowNull: true
        },
        data_pagamento_financeiro: {
            type: Sequelize.STRING,
            allowNull: true
        },
        data_vigencia: {
            type: Sequelize.DATE,
            allowNull: true
        },
    });

    return Incentives_Propostas;
};