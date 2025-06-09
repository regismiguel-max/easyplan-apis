import CRUDEmailCampaignDTO from "../../presentation/dtos/email-campaign/input/crud-email-campaign.dto";
import EmailCampaignEntity from "../entities/EmailCampaign";
// import { EmailCampaignAttributes } from "../../infrastructure/repositories/models/email-campaign.model";
// import { EmailCampaignStatus } from "../types/email-status.types";
// import { Periodicity } from "../enums/email-periodicity.types";
// import Schedule from "../value-objects/schedule.valueObjects";
// import SenderCampaignDTO from "../../presentation/dtos/sender-campaign.dto";
import FiltersVO from "../value-objects/filters.valueObjects";

/**
 * Factory para criar instâncias de EmailCampaign a partir de dados crus
 * (DTOs vindos de requisições ou do banco de dados).
 */
export class EmailCampaignFactory {
  /**
   * Cria uma nova instância de EmailCampaign a partir de dados brutos (DTO, banco, etc.)
   * @param props 
   * @returns EmailCampaign
   */
  public static createFromPersistence(props: CRUDEmailCampaignDTO): EmailCampaignEntity {

    const filters: FiltersVO = new FiltersVO(props.filtersValues, props.booleansFiltersFlags);
    
    if(!filters) throw new Error('Falha ao criar VO Filters');
    
    // {
      // let date: Date = new Date();
      
      // if (props.schedule) date = new Date(props.schedule.dateSchedule);
      
      // const schedule: Schedule | undefined = props.schedule ? new Schedule(props.schedule.doSchedule, date, props.schedule.periodicity) : undefined;
  
      // if(!schedule) throw new Error('Falha ao criar VO Schedule');
    // }
    console.log('Vê o filter antes de criar EmailCampaignEntity: ', filters);
    return new EmailCampaignEntity(props.emailCampaignBaseInformations, filters);
  }

  // public static createFromSend(emailCampaignSendDTO: SenderCampaignDTO): EmailCampaignEntity | void {
  //   const filters: FiltersVO = new FiltersVO(emailCampaignSendDTO.dataCampaign.filters);
    
  //   if(!filters) throw new Error('Falha ao criar VO Filters');
    
  //   // {
  //     // let date: Date = new Date();
      
  //     // if (emailCampaignSendDTO.dataCampaign.schedule) date = new Date(emailCampaignSendDTO.dataCampaign.schedule.dateSchedule);
      
  //     // const schedule: Schedule | undefined = emailCampaignSendDTO.dataCampaign.schedule ? new Schedule(emailCampaignSendDTO.dataCampaign.schedule.doSchedule, date, emailCampaignSendDTO.dataCampaign.schedule.periodicity) : undefined;
  
  //     // if(!schedule) throw new Error('Falha ao criar VO Schedule');
  //   // }

  //   return new EmailCampaignEntity(
  //     emailCampaignSendDTO.dataCampaign.campaignName,
  //     emailCampaignSendDTO.dataCampaign.subject,
  //     emailCampaignSendDTO.dataCampaign.status,
  //     emailCampaignSendDTO.dataCampaign.id ? emailCampaignSendDTO.dataCampaign.id : undefined,
  //     emailCampaignSendDTO.dataCampaign.emailTemplateId ? emailCampaignSendDTO.dataCampaign.emailTemplateId : undefined,
  //     filters ? filters : undefined,
  //     schedule ? schedule : undefined
  //   );
  // }

  /**
   * Cria uma nova instância para cadastro (sem ID ainda atribuído).
   * @param props 
   * @returns EmailCampaign
   */
  public static async createNew(props: CRUDEmailCampaignDTO): Promise<EmailCampaignEntity> {
    return this.createFromPersistence({ ...props});
  }
}