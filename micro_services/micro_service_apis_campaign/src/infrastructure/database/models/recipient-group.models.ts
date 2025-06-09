import { DataTypes } from "sequelize";
import EmailCampaignModel from "./email-campaign.model";
import connection_db from "../config/database";

const RecipientGroupModel = connection_db.define(
  "RecipientGroupModel",
  {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    emailCampaignId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: EmailCampaignModel,
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
  },
  {
    tableName: "cliente_campanha_email_recipient_group",
    timestamps: true,
  }
);

export default RecipientGroupModel;
