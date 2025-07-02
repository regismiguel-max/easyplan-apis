// associate.ts
import CampaignTemplateModel from './template.model';
import CampaignModel from './campaign.model';
import StatisticsEmailCampaignModel from './statistics-email-campaign.model';
import EmailScheduleModel from './filters/schedules.models';
import AgeRangeModel from './filters/age-range.models';
import ValidityModel from './filters/validity.model';
import OperatorsModel from './filters/operators.models';
import PlansModel from './filters/plans.models';
import ContractStatusModel from './filters/contract-status.models';
import ModalityModel from './filters/modality.models';
import UfModel from './filters/uf.models';
import RecipientGroupModel from './recipient-group.models';
import CampaignOperatorsModel from './associations/campaign-operators.models';
import CampaignPlansModel from './associations/campaign-plans.model';
import CampaignContractStatusModel from './associations/campaign-contract-status.models';
import CampaignModalityModel from './associations/campaign-modality.models';
import CampaignUfsModel from './associations/campaign-ufs.models';
import StatisticsWhatsCampaignModel from './statistics-whats-campaign.model';
import CampaignMessageStatusesModel from './campaign-message-statuses.model';
import FailedEmailModel from './failed-emails.model';

export function associateModels() {
  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + TEMPLATE ************************/
  CampaignTemplateModel.hasMany(CampaignModel, { foreignKey: 'templateId' });
  CampaignModel.belongsTo(CampaignTemplateModel, { foreignKey: 'templateId' });

  //************************ RELACIONAMENTO CAMPAIGN + FAILED EMAILS ************************/
  CampaignModel.hasMany(FailedEmailModel, {foreignKey: 'campaingId'});
  FailedEmailModel.belongsTo(CampaignModel, {foreignKey: 'campaingId'});

  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + STATISTICS ************************/
  StatisticsEmailCampaignModel.belongsTo(CampaignModel, { foreignKey: 'emailCampaignId'});
  CampaignModel.hasOne(StatisticsEmailCampaignModel, { foreignKey: 'emailCampaignId' });
  //************************ RELACIONAMENTO CAMPAIGN + WHATSAPP STATISTICS ************************/
  StatisticsWhatsCampaignModel.belongsTo(CampaignModel, { foreignKey: 'campaignId'});
  CampaignModel.hasOne(StatisticsWhatsCampaignModel, { foreignKey: 'campaignId' });
  //************************ RELACIONAMENTO CAMPAIGN + WHATSAPP STATUS MESSASGE ************************/
  CampaignMessageStatusesModel.belongsTo(CampaignModel, { foreignKey: 'campaignId'});
  CampaignModel.hasMany(CampaignMessageStatusesModel, { foreignKey: 'campaignId' });

  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + SCHEDULE ************************/
  EmailScheduleModel.belongsTo(CampaignModel, { foreignKey: 'emailCampaignId' });
  CampaignModel.hasOne(EmailScheduleModel, { foreignKey: 'emailCampaignId' });

  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + AGE_RANGE ************************/
  AgeRangeModel.belongsTo(CampaignModel, { foreignKey: 'campaignId' });
  CampaignModel.hasOne(AgeRangeModel, { foreignKey: 'campaignId' });

  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + RECIPIENT_GROUP ************************/
  RecipientGroupModel.belongsTo(CampaignModel, { foreignKey: 'campaignId' });
  CampaignModel.hasOne(RecipientGroupModel, { foreignKey: 'campaignId' });

  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + VALIDITY ************************/
  ValidityModel.belongsTo(CampaignModel, { foreignKey: 'campaignId' });
  CampaignModel.hasOne(ValidityModel, { foreignKey: 'campaignId' });
  
  //************************ RELACIONAMENTO OPERATOR + PLAN ************************/
  OperatorsModel.hasMany(PlansModel, { foreignKey: 'codigo_produto' });
  PlansModel.belongsTo(OperatorsModel, { foreignKey: 'codigo_produto' });

  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + OPERATOR_FILTER ************************/
  CampaignModel.belongsToMany(OperatorsModel, { 
    through: CampaignOperatorsModel,
    foreignKey: 'campaignId',
    otherKey: 'operatorId'
  });
  OperatorsModel.belongsToMany(CampaignModel, { 
    through: CampaignOperatorsModel,
    foreignKey: 'operatorId',
    otherKey: 'campaignId'
  });
  
  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + PLAN_FILTER ************************/
  CampaignModel.belongsToMany(PlansModel, { 
    through: CampaignPlansModel,
    foreignKey: 'campaignId',
    otherKey: 'planId'
  });
  PlansModel.belongsToMany(CampaignModel, { 
    through: CampaignPlansModel,
    foreignKey: 'planId',
    otherKey: 'campaignId'
  });
  
  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + CONTRACT_STATUS_FILTER ************************/
  CampaignModel.belongsToMany(ContractStatusModel, { 
    through: {
      model: CampaignContractStatusModel,
      unique: false
    },
    foreignKey: 'campaignId',
    otherKey: 'contractStatusId'
  });
  ContractStatusModel.belongsToMany(CampaignModel, { 
    through: {
      model: CampaignContractStatusModel,
      unique: false
    },
    foreignKey: 'contractStatusId',
    otherKey: 'campaignId'
  });
  
  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + MODALITY_FILTER ************************/
  CampaignModel.belongsToMany(ModalityModel, { 
    through: CampaignModalityModel,
    foreignKey: 'campaignId',
    otherKey: 'modalityId'
  });
  ModalityModel.belongsToMany(CampaignModel, { 
    through: CampaignModalityModel,
    foreignKey: 'modalityId',
    otherKey: 'campaignId'
  });
  
  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + UF_FILTER ************************/
  CampaignModel.belongsToMany(UfModel, { 
    through: CampaignUfsModel,
    foreignKey: 'campaignId',
    otherKey: 'ufId'
  });
  UfModel.belongsToMany(CampaignModel, { 
    through: CampaignUfsModel,
    foreignKey: 'ufId',
    otherKey: 'campaignId'
  });
}
