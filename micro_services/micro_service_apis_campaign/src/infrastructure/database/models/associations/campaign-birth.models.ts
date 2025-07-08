import { DataTypes, Model, Optional } from "sequelize";
import connection_db from "../../config/database";
import CampaignModel from "../campaign.model";

interface BirthAttributes {
  id: number | null;
  campaignId: number;
  day: number | null;
  month: string | null;
  year: number | null;

}

interface BirthCreationAttributes extends Optional<BirthAttributes, keyof BirthAttributes> {}

const BirthModel = connection_db.define<Model<BirthAttributes, BirthCreationAttributes>>(
    'BirthModel', 
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        campaignId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: { model: CampaignModel, key: 'id' },
        },
        day: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        month: {
            type: DataTypes.STRING,
            allowNull: true
        },
        year: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    },
    {
        tableName: 'cliente_campanha_campaigns_birth',
        timestamps: true
    }
)

export default BirthModel;