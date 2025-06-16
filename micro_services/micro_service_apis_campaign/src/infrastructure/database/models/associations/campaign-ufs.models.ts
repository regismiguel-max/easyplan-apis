import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import CampaignModel from "../campaign.model";
import UfModel from "../filters/uf.models";

const CampaignUfsModel = connection_db.define(
    'CampaignUfsModel',
    {
        campaignId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: CampaignModel, key: 'id' },
        },
        ufId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: UfModel, key: 'estadoID' },
        },
    },
    {
        tableName: 'cliente_campanha_campaign_ufs',
        timestamps: true
    }
);
  
export default CampaignUfsModel;