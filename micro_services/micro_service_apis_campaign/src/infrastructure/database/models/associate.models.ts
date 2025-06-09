// associate.ts
import EmailTemplateModel from './email-template.model';
import EmailCampaignModel from './email-campaign.model';
import StatisticsEmailCampaignModel from './statistics-email-campaign.model';
import EmailPlansModel from './associations/email-plans.model';
import EmailOperatorsModel from './associations/email-operators.models';
import EmailModalityModel from './associations/email-modality.models';
import EmailUfsModel from './associations/email-ufs.models';
import EmailContractStatusModel from './associations/email-contract-status.models';
import EmailScheduleModel from './filters/schedules.models';
import AgeRangeModel from './filters/age-range.models';
import ValidityModel from './filters/validity.model';
import OperatorsModel from './filters/operators.models';
import PlansModel from './filters/plans.models';
import ContractStatusModel from './filters/contract-status.models';
import ModalityModel from './filters/modality.models';
import UfModel from './filters/uf.models';
import RecipientGroupModel from './recipient-group.models';

export function associateModels() {
  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + TEMPLATE ************************/
  EmailTemplateModel.hasMany(EmailCampaignModel, { foreignKey: 'emailTemplateId' });
  EmailCampaignModel.belongsTo(EmailTemplateModel, { foreignKey: 'emailTemplateId' });

  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + STATISTICS ************************/
  StatisticsEmailCampaignModel.belongsTo(EmailCampaignModel, { foreignKey: 'emailCampaignId'});
  EmailCampaignModel.hasOne(StatisticsEmailCampaignModel, { foreignKey: 'emailCampaignId' });

  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + SCHEDULE ************************/
  EmailScheduleModel.belongsTo(EmailCampaignModel, { foreignKey: 'emailCampaignId' });
  EmailCampaignModel.hasOne(EmailScheduleModel, { foreignKey: 'emailCampaignId' });

  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + AGE_RANGE ************************/
  AgeRangeModel.belongsTo(EmailCampaignModel, { foreignKey: 'emailCampaignId' });
  EmailCampaignModel.hasOne(AgeRangeModel, { foreignKey: 'emailCampaignId' });

  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + RECIPIENT_GROUP ************************/
  RecipientGroupModel.belongsTo(EmailCampaignModel, { foreignKey: 'emailCampaignId' });
  EmailCampaignModel.hasOne(RecipientGroupModel, { foreignKey: 'emailCampaignId' });

  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + VALIDITY ************************/
  ValidityModel.belongsTo(EmailCampaignModel, { foreignKey: 'emailCampaignId' });
  EmailCampaignModel.hasOne(ValidityModel, { foreignKey: 'emailCampaignId' });
  
  //************************ RELACIONAMENTO OPERATOR + PLAN ************************/
  OperatorsModel.hasMany(PlansModel, { foreignKey: 'codigo_produto' });
  PlansModel.belongsTo(OperatorsModel, { foreignKey: 'codigo_produto' });

  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + OPERATOR_FILTER ************************/
  EmailCampaignModel.belongsToMany(OperatorsModel, { 
    through: EmailOperatorsModel,
    foreignKey: 'emailCampaignId',
    otherKey: 'operatorId'
  });
  OperatorsModel.belongsToMany(EmailCampaignModel, { 
    through: EmailOperatorsModel,
    foreignKey: 'operatorId',
    otherKey: 'emailCampaignId'
  });
  
  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + PLAN_FILTER ************************/
  EmailCampaignModel.belongsToMany(PlansModel, { 
    through: EmailPlansModel,
    foreignKey: 'emailCampaignId',
    otherKey: 'planId'
  });
  PlansModel.belongsToMany(EmailCampaignModel, { 
    through: EmailPlansModel,
    foreignKey: 'planId',
    otherKey: 'emailCampaignId'
  });
  
  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + CONTRACT_STATUS_FILTER ************************/
  EmailCampaignModel.belongsToMany(ContractStatusModel, { 
    through: {
      model: EmailContractStatusModel,
      unique: false
    },
    foreignKey: 'emailCampaignId',
    otherKey: 'contractStatusId'
  });
  ContractStatusModel.belongsToMany(EmailCampaignModel, { 
    through: {
      model: EmailContractStatusModel,
      unique: false
    },
    foreignKey: 'contractStatusId',
    otherKey: 'emailCampaignId'
  });
  
  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + MODALITY_FILTER ************************/
  EmailCampaignModel.belongsToMany(ModalityModel, { 
    through: EmailModalityModel,
    foreignKey: 'emailCampaignId',
    otherKey: 'modalityId'
  });
  ModalityModel.belongsToMany(EmailCampaignModel, { 
    through: EmailModalityModel,
    foreignKey: 'modalityId',
    otherKey: 'emailCampaignId'
  });
  
  //************************ RELACIONAMENTO EMAIL_CAMPAIGN + UF_FILTER ************************/
  EmailCampaignModel.belongsToMany(UfModel, { 
    through: EmailUfsModel,
    foreignKey: 'emailCampaignId',
    otherKey: 'ufId'
  });
  UfModel.belongsToMany(EmailCampaignModel, { 
    through: EmailUfsModel,
    foreignKey: 'ufId',
    otherKey: 'emailCampaignId'
  });
}
