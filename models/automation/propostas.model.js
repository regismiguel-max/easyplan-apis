module.exports = (sequelize, Sequelize) => {
    const Proposta = sequelize.define(
        "automation_propostas",
        {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
            },

            // mantém os mesmos nomes de atributos do seu Model TS/JS atual
            propostaID: {
                type: Sequelize.BIGINT,
                allowNull: false,
                unique: true,
                field: "proposta_id",
            },

            oper_propnum: { type: Sequelize.STRING, field: "oper_propnum" },
            oper_protocolo: { type: Sequelize.STRING, field: "oper_protocolo", allowNull: true },

            contrato: { type: Sequelize.STRING, field: "contrato" },
            tipo_proposta: { type: Sequelize.STRING, field: "tipo_proposta" },
            produto: { type: Sequelize.STRING, field: "produto" },

            beneficiarios: { type: Sequelize.INTEGER, field: "beneficiarios" },
            status: { type: Sequelize.STRING, field: "status" },
            decsau: { type: Sequelize.INTEGER, field: "decsau" },

            pgtoccredito: { type: Sequelize.STRING, field: "pgtoccredito", allowNull: true },

            date_sig: { type: Sequelize.STRING, field: "date_sig" },
            date_sale: { type: Sequelize.STRING, field: "date_sale" },
            date_vigencia: { type: Sequelize.STRING, field: "date_vigencia" },

            vendedor_cpf: { type: Sequelize.STRING, field: "vendedor_cpf" },
            vendedor_nome: { type: Sequelize.STRING, field: "vendedor_nome" },

            concessionaria_cnpj: { type: Sequelize.STRING, field: "concessionaria_cnpj", allowNull: true },
            concessionaria_nome: { type: Sequelize.STRING, field: "concessionaria_nome", allowNull: true },

            corretora_cnpj: { type: Sequelize.STRING, field: "corretora_cnpj" },
            corretora_nome: { type: Sequelize.STRING, field: "corretora_nome" },

            contratante_cpf: { type: Sequelize.STRING, field: "contratante_cpf" },
            contratante_nome: { type: Sequelize.STRING, field: "contratante_nome" },
            contratante_email: { type: Sequelize.STRING, field: "contratante_email" },
            contratante_cnpj: { type: Sequelize.STRING, field: "contratante_cnpj", allowNull: true },

            datacadastro: { type: Sequelize.STRING, field: "datacadastro" },
            datamodificacao: { type: Sequelize.STRING, field: "datamodificacao" },
            datacriacao: { type: Sequelize.STRING, field: "datacriacao" },

            uf: { type: Sequelize.STRING, field: "uf" },
            data_notificacao: { type: Sequelize.STRING, field: "data_notificacao" },

            total_valor: { type: Sequelize.FLOAT, field: "total_valor" },

            motivo_pendencia_doc: { type: Sequelize.JSON, field: "motivo_pendencia_doc", allowNull: true },
            motivo_cancelamento: { type: Sequelize.JSON, field: "motivo_cancelamento", allowNull: true },
            metadados: { type: Sequelize.JSON, field: "metadados", allowNull: true },

            possui_contrato_digital: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                field: "possui_contrato_digital",
            },
        },
        {
            tableName: "automation_propostas",
            timestamps: true,
            underscored: true,
            indexes: [{ fields: ["proposta_id"] }],
        }
    );

    return Proposta;
};
