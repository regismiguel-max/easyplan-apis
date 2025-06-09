import {
  DataTypes,
  Optional,
  Model,
} from "sequelize";
import connection_db from "../../database/config/database";
import { EmailCampaignStatus } from "../../../domain/types/email-status.types";
import EmailTemplateModel from "./email-template.model";


interface EmailCampaignAttributes {
  id: number | null;
  campaignName: string;
  subject: string;
  status: EmailCampaignStatus;
  emailTemplateId: number | null;
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

const EmailCampaignModel = connection_db.define<Model<EmailCampaignAttributes, EmailCampaignCreationAttributes>>(
  "EmailCampaignModel",
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
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("DRAFT", "PENDING", "SENT", "FAILED"),
      defaultValue: "DRAFT",
      allowNull: false,
    },
    emailTemplateId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: EmailTemplateModel,
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
    tableName: "cliente_campanha_email_campaigns",
    timestamps: true,
  }
);

export default EmailCampaignModel;
export { EmailCampaignAttributes };
