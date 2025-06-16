import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import CampaignModel from "../campaign.model";

const ValidityModel = connection_db.define(
    'ValidityModel',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        start: {
            type: DataTypes.DATE,
            allowNull: false
        },
        end: {
            type: DataTypes.DATE,
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
        tableName: 'cliente_campanha_campaign_validity',
        timestamps: true
    }
)

export default ValidityModel;