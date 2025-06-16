import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import CampaignModel from "../campaign.model";
import ModalityModel from "../filters/modality.models";

const CampaignModalityModel = connection_db.define(
    'CampaignModalityModel',
    {
        campaignId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: CampaignModel, key: 'id' },
        },
        modalityId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: ModalityModel, key: 'id' },
        },
    },
    {
        tableName: 'cliente_campanha_campaign_modalities',
        timestamps: true
    }
);
  
export default CampaignModalityModel;