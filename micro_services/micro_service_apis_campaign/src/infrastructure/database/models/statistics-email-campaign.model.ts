import { DataTypes, Optional, Model } from "sequelize";
import connection_db from "../config/database";
import CampaignModel from "./campaign.model";


interface StatisticsEmailCampaignAttributes {
    id: number;
    emailCampaignId: number; // Nova referência à campanha
    countsRecipients: number;
    processed: number;
    delivered: number;
    open: number;
    click: number; // Novo campo para cliques
    bounce: number; // Novo campo para bounces
    dropped: number;
    spam: number; // Novo campo para relatórios de spam
    unsubscribe: number; // Novo campo para cancelamentos de inscrição
    
    // Timestamps para eventos importantes
    firstProcessedAt: Date | null;
    lastProcessedAt: Date | null;
    firstDeliveredAt: Date | null;
    lastDeliveredAt: Date | null;
    firstOpenAt: Date | null;
    lastOpenAt: Date | null;
    
    // Taxas calculadas (podem ser atualizadas em tempo real ou via consulta)
    deliveryRate: number; // Taxa de entrega (delivered/processed)
    openRate: number; // Taxa de abertura (open/delivered)
}

// Definição dos atributos que são opcionais na criação
interface StatisticsEmailCampaignCreationAttributes extends Optional<StatisticsEmailCampaignAttributes, 
    "id" | "processed" | "delivered" | "open" | "click" | "bounce" | "dropped" | "spam" | "unsubscribe" |
    "firstProcessedAt" | "lastProcessedAt" | "firstDeliveredAt" | "lastDeliveredAt" | "firstOpenAt" | "lastOpenAt" |
    "deliveryRate" | "openRate"> {}

const StatisticsEmailCampaignModel = connection_db.define<Model<StatisticsEmailCampaignAttributes, StatisticsEmailCampaignCreationAttributes>>(
    'StatisticsEmailCampaignModel',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        emailCampaignId: {
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
        processed: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        delivered: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        open: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        click: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        bounce: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        dropped: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        spam: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        unsubscribe: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        // Timestamps para eventos
        firstProcessedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        lastProcessedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        firstDeliveredAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        lastDeliveredAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        firstOpenAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        lastOpenAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Taxas calculadas
        deliveryRate: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0
        },
        openRate: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0
        },
    },
    {
        tableName: "cliente_campanha_statistics_email_campaigns",
        timestamps: true,
    }
);

export default StatisticsEmailCampaignModel;
export { StatisticsEmailCampaignAttributes, StatisticsEmailCampaignCreationAttributes };