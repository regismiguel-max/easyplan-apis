import {
  DataTypes,
  Optional,
  Model,
} from "sequelize";
import connection_db from "../config/database";
import { CampaignStatus } from "../../../domain/enums/campaign-status.enum";
import CampaignTemplateModel from "./template.model";


interface EmailCampaignAttributes {
  id: number | null;
  campaignName: string;
  subject?: string;
  status: CampaignStatus;
  typeCampaign: string;
  templateId: number | null;
  // doSchedule: boolean;
  filterByAgeRange: boolean;
  filterByContractStatus: boolean;
  // filterByModality: boolean;
  filterByOperator: boolean;
  filterByPlan: boolean;
  filterByUf: boolean;
  filterByValidity: boolean;
}

interface EmailCampaignCreationAttributes extends Optional<EmailCampaignAttributes, keyof EmailCampaignAttributes> {}

const CampaignModel = connection_db.define<Model<EmailCampaignAttributes, EmailCampaignCreationAttributes>>(
  "CampaignModel",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    campaignName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("DRAFT", "PENDING", "SENT", "FAILED", "QUEUED"),
      defaultValue: "DRAFT",
      allowNull: false,
    },
    typeCampaign: {
      type: DataTypes.STRING,
      allowNull: false
    },
    templateId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: CampaignTemplateModel,
        key: 'id'
      }
    },
    // doSchedule: {
    //     type: DataTypes.BOOLEAN,
    //     allowNull: true,
    // },
    filterByAgeRange: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
    },
    filterByContractStatus: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
    },
    // filterByModality: {
    //     type: DataTypes.BOOLEAN,
    //     allowNull: true,
    // },
    filterByOperator: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
    },
    filterByPlan: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
    },
    filterByUf: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
    },
    filterByValidity: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
    },
  },
  {
    tableName: "cliente_campanha_campaigns",
    timestamps: true,
  }
);

export default CampaignModel;
export { EmailCampaignAttributes };
