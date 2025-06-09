import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import EmailCampaignModel from "../email-campaign.model";
import ContractStatusModel from "../filters/contract-status.models";

const EmailContractStatusModel = connection_db.define(
    'EmailContractStatusModel',
    {
        emailCampaignId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: EmailCampaignModel, key: 'id' },
            field: 'emailCampaignId'
        },
        contractStatusId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: ContractStatusModel, key: 'id' },
            field: 'contractStatusId'
        },
    },
    {
        tableName: 'cliente_campanha_email_contract_statuses',
        timestamps: true,
        indexes: [
            {
                unique: true,
                name: 'uniqueEmailCampaignContractStatus',
                fields: ['emailCampaignId', 'contractStatusId']
            }
        ]
    }
);
  
export default EmailContractStatusModel;