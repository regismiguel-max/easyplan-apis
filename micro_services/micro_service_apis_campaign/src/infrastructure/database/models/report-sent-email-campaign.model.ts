import { DataTypes, Optional, Model } from "sequelize";
import connection_db from "../config/database";
import CampaignModel from "./campaign.model";


interface ReportEmailAttributes {
    id: number;
    campaignId: number; // Nova referência à campanha
    emailRecipient: string;
    sent_date: string;
    open_date: string;
    click_date: string;
    ip: string;
}

// Definição dos atributos que são opcionais na criação
interface ReportEmailCreationAttributes extends Optional<ReportEmailAttributes, "id" | "open_date" | "click_date" | "ip"> {}

const ReportEmailModel = connection_db.define<Model<ReportEmailAttributes, ReportEmailCreationAttributes>>(
    'ReportEmailModel',
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
        emailRecipient: {
            type: DataTypes.STRING,
            allowNull: false
        },
        sent_date: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        open_date: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        click_date: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        ip: {
            type: DataTypes.STRING,
            allowNull: true,
        }
    },
    {
        tableName: "cliente_campanha_report_email",
        timestamps: true,
    }
);

export default ReportEmailModel;
export { ReportEmailAttributes, ReportEmailCreationAttributes };