import {
  DataTypes,
  Optional,
  Model,
} from "sequelize";
import connection_db from "../../database/config/database";
import { EmailCampaignStatus } from "../../../domain/types/email-status.types";
import EmailTemplateModel from "./email-template.model";

const ClientModel = connection_db.define(
  "ClientModel",
  {
    codigo_contrato: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    convenio: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sub_estipulante: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    plano: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    produto: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
    },
    acomodacao: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nome_beneficiario: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    tipo_beneficiario: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    status_do_beneficiario: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    sexo: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    data_nascimento: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    idade: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    nascimento_titular: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    vigencia: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    ddd_celular: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    celular: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    email_principal: {
        type: DataTypes.STRING,
        allowNull: true,
    },
  },
  {
    tableName: "cliente_digital_beneficiarios",
    timestamps: true,
  }
);

export default ClientModel;
