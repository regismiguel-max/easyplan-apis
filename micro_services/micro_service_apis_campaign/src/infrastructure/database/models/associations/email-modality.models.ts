import { DataTypes } from "sequelize";
import connection_db from "../../config/database";
import EmailCampaignModel from "../email-campaign.model";
import ModalityModel from "../filters/modality.models";

const EmailModalityModel = connection_db.define(
    'EmailModalityModel',
    {
        emailCampaignId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: EmailCampaignModel, key: 'id' },
        },
        modalityId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: ModalityModel, key: 'id' },
        },
    },
    {
        tableName: 'cliente_campanha_email_modalities',
        timestamps: true
    }
);
  
export default EmailModalityModel;