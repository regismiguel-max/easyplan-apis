import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import EmailCampaignModel from "../email-campaign.model";
import PlansModel from "../filters/plans.models";

const EmailPlansModel = connection_db.define(
    'EmailPlansModel',
    {
        emailCampaignId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: EmailCampaignModel, key: 'id' },
        },
        planId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: PlansModel, key: 'id' },
        },
    },
    {
        tableName: 'cliente_campanha_email_plans',
        timestamps: true
    }
);
  
export default EmailPlansModel;