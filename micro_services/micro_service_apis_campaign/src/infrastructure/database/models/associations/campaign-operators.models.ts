import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import CampaignModel from "../campaign.model";
import OperatorsModel from "../filters/operators.models";

const CampaignOperatorsModel = connection_db.define(
    'CampaignOperatorsModel',
    {
        campaignId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: CampaignModel, key: 'id' },
        },
        operatorId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: OperatorsModel, key: 'id' },
        },
    },
    {
        tableName: 'cliente_campanha_campaign_operators',
        timestamps: true
    }
);
  
export default CampaignOperatorsModel;