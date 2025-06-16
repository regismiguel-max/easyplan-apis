import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import CampaignModel from "../campaign.model";


const EmailScheduleModel = connection_db.define(
    "EmailScheduleModel",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        scheduleDate: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        periodicity: {
            type: DataTypes.ENUM("ONE", "WEEKLY", "MONTHLY"),
            allowNull: false,
        },
        emailCampaignId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: CampaignModel,
                key: 'id'
            }
        }
    },
    {
        tableName: 'cliente_campanha_email_schedules',
        timestamps: true
    }
);

export default EmailScheduleModel;
