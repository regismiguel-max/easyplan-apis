import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import CampaignModel from "../campaign.model";
import ContractStatusModel from "../filters/contract-status.models";

const CampaignContractStatusModel = connection_db.define(
    'CampaignContractStatusModel',
    {
        campaignId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: CampaignModel, key: 'id' },
            field: 'campaignId'
        },
        contractStatusId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: ContractStatusModel, key: 'id' },
            field: 'contractStatusId'
        },
    },
    {
        tableName: 'cliente_campanha_campaign_contract_statuses',
        timestamps: true,
        indexes: [
            {
                unique: true,
                name: 'uniqueEmailCampaignContractStatus',
                fields: ['campaignId', 'contractStatusId']
            }
        ]
    }
);
  
export default CampaignContractStatusModel;