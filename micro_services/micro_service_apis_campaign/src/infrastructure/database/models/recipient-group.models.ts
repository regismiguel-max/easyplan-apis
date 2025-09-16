import { DataTypes } from "sequelize";
import CampaignModel from "./campaign.model";
import connection_db from "../config/database";

const RecipientGroupModel = connection_db.define(
  "RecipientGroupModel",
  {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    campaignId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: CampaignModel,
            key: 'id'
        }
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
    operadora: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    plano: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    status_do_beneficiario: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    uf: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    sexo: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    convenio: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    subestipulante: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    nome_do_beneficiario: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    vigencia: {
        type: DataTypes.STRING,
        allowNull: true,
    },
  },
  {
    tableName: "cliente_campanha_campaign_recipient_group",
    timestamps: true,
  }
);

export default RecipientGroupModel;
