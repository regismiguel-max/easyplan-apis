import { DataTypes, Model, Optional } from "sequelize";
import connection_db from "../config/database";
import CampaignModel from "./campaign.model";

interface StatisticsWhatsCampaignAttributes {
    id: number;
    campaignId: number; // Nova referência à campanha
    countsRecipients: number;
    sent: number;
    failed: number;
    
    // Taxas calculadas (podem ser atualizadas em tempo real ou via consulta)
    sentRate: number; // Taxa de entrega (delivered/processed)
}

// Definição dos atributos que são opcionais na criação
interface StatisticsWhatsCampaignCreationAttributes extends Optional<StatisticsWhatsCampaignAttributes, "id" | "sent" | "failed" | "sentRate"> {}

const StatisticsWhatsCampaignModel = connection_db.define<Model<StatisticsWhatsCampaignAttributes, StatisticsWhatsCampaignCreationAttributes>>(
    'StatisticsWhatsCampaignModel',
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
        countsRecipients: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        sent: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        failed: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        // Taxas calculadas
        sentRate: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0
        },
    },
    {
        tableName: "cliente_campanha_statistics_whats_campaigns",
        timestamps: true,
    }
);

export default StatisticsWhatsCampaignModel;
export { StatisticsWhatsCampaignAttributes, StatisticsWhatsCampaignCreationAttributes };