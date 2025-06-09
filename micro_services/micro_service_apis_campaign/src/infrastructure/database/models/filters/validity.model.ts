import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import EmailCampaignModel from "../email-campaign.model";

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
        tableName: 'cliente_campanha_email_validity',
        timestamps: true
    }
)

export default ValidityModel;