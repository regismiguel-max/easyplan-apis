import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import EmailCampaignModel from "../email-campaign.model";
import OperatorsModel from "../filters/operators.models";

const EmailOperatorsModel = connection_db.define(
    'EmailOperatorsModel',
    {
        emailCampaignId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: EmailCampaignModel, key: 'id' },
        },
        operatorId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: OperatorsModel, key: 'id' },
        },
    },
    {
        tableName: 'cliente_campanha_email_operators',
        timestamps: true
    }
);
  
export default EmailOperatorsModel;