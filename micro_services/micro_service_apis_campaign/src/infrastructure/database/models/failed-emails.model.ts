import { DataTypes, Optional, Model } from "sequelize";
import connection_db from "../config/database";
import CampaignModel from "./campaign.model";


interface FailedEmailAttributes {
    id: number;
    campaignId: number; // Nova referência à campanha
    event: string;
    emailRecipient: string;
    reason: string;
}

// Definição dos atributos que são opcionais na criação
interface FailedEmailCreationAttributes extends Optional<FailedEmailAttributes, "id" | "campaignId" | "event" | "emailRecipient"> {}

const FailedEmailModel = connection_db.define<Model<FailedEmailAttributes, FailedEmailCreationAttributes>>(
    'FailedEmailModel',
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
        event: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 0
        },
        emailRecipient: {
            type: DataTypes.STRING,
            allowNull: false
        },
        reason: {
            type: DataTypes.STRING,
            allowNull: false
        }
    },
    {
        tableName: "cliente_campanha_email_failed",
        timestamps: true,
    }
);

export default FailedEmailModel;
export { FailedEmailAttributes, FailedEmailCreationAttributes };