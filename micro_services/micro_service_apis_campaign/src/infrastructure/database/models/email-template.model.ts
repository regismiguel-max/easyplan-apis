import { DataTypes } from "sequelize";
import connection_db from "../config/database";
import EmailCampaignModel from "./email-campaign.model";

const EmailTemplateModel = connection_db.define(
    'EmailTemplateModel',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        templateName: {
            type: DataTypes.STRING,
        },
        absolutePath: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: 'cliente_campanha_email_templates',
        timestamps: true
    }
);

export default EmailTemplateModel;