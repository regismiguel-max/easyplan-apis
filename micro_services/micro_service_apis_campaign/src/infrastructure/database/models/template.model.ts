import { DataTypes } from "sequelize";
import connection_db from "../config/database";

const CampaignTemplateModel = connection_db.define(
    'CampaignTemplateModel',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        templateName: {
            type: DataTypes.STRING,
        },
        templateContent: {
            type: DataTypes.STRING,
        },
        typeTemplate: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        imageId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    },
    {
        tableName: 'cliente_campanha_campaign_templates',
        timestamps: true
    }
);

export default CampaignTemplateModel;