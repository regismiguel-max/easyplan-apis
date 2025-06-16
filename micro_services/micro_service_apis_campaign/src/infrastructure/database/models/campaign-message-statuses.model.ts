import { DataTypes, Model, Optional } from "sequelize";
import connection_db from "../config/database";
import CampaignModel from "./campaign.model";
import { Payload } from "../../providers/whatsapp-campaign-sender.provider";

interface CampaignMessageStatusAttributes {
    id: number;
    campaignId: number;
    number: number;
    idMessage: number;
    chunkIndex: number;
    status?: string | null;
    checked: boolean;
    checkedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

interface CampaignMessageStatusCreationAttributes extends Optional<CampaignMessageStatusAttributes, 'id' | 'checked' | 'checkedAt'> {}

const CampaignMessageStatusesModel = connection_db.define<Model<CampaignMessageStatusAttributes, CampaignMessageStatusCreationAttributes>>(
    'CampaignMessageStatusesModel',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        campaignId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: CampaignModel,
                key: 'id'
            }
        },
        number: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        idMessage: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        chunkIndex: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        status: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        checked: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        checkedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        tableName: 'cliente_campanha_campaign_message_statuses',
        timestamps: true
    }
);

export default CampaignMessageStatusesModel;