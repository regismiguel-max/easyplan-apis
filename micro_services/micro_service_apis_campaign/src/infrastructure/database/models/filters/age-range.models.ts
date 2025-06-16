import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import CampaignModel from "../campaign.model";

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
        campaignId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: CampaignModel,
                key: 'id'
            }
        }
    },
    {
        tableName: 'cliente_campanha_campaign_age_ranges',
        timestamps: true
    }
)

export default AgeRangeModel;