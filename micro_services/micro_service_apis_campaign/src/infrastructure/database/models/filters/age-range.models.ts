import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import EmailCampaignModel from "../email-campaign.model";

const AgeRangeModel = connection_db.define(
    'AgeRangeModel',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        min: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        max: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        emailCampaignId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: EmailCampaignModel,
                key: 'id'
            }
        }
    },
    {
        tableName: 'cliente_campanha_email_age_ranges',
        timestamps: true
    }
)

export default AgeRangeModel;