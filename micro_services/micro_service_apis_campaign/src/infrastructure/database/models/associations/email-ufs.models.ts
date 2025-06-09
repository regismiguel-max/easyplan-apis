import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import EmailCampaignModel from "../email-campaign.model";
import UfModel from "../filters/uf.models";

const EmailUfsModel = connection_db.define(
    'EmailUfsModel',
    {
        emailCampaignId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: EmailCampaignModel, key: 'id' },
        },
        ufId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: UfModel, key: 'estadoID' },
        },
    },
    {
        tableName: 'cliente_campanha_email_ufs',
        timestamps: true
    }
);
  
export default EmailUfsModel;