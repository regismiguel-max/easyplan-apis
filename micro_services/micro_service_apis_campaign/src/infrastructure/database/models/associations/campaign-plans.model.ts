import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import CampaignModel from "../campaign.model";
import PlansModel from "../filters/plans.models";

const CampaignPlansModel = connection_db.define(
    'CampaignPlansModel',
    {
        campaignId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: CampaignModel, key: 'id' },
        },
        planId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: PlansModel, key: 'id' },
        },
    },
    {
        tableName: 'cliente_campanha_campaign_plans',
        timestamps: true
    }
);
  
export default CampaignPlansModel;