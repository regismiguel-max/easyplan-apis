import CRUDCampaignDTO from "../../presentation/dtos/crud-campaign.dto";
import CampaignEntity from "../entities/Campaign";
import FiltersVO from "../value-objects/filters.valueObjects";

export default class CampaignFactory {
  public static createFromPersistence(props: CRUDCampaignDTO): CampaignEntity {

    const filters: FiltersVO = new FiltersVO(props.filtersValues, props.booleansFiltersFlags);
    
    if(!filters) throw new Error('Falha ao criar VO Filters');
    
    // {
      // let date: Date = new Date();
      
      // if (props.schedule) date = new Date(props.schedule.dateSchedule);
      
      // const schedule: Schedule | undefined = props.schedule ? new Schedule(props.schedule.doSchedule, date, props.schedule.periodicity) : undefined;
  
      // if(!schedule) throw new Error('Falha ao criar VO Schedule');
    // }
    console.log('Vê o filter antes de criar EmailCampaignEntity: ', filters);
    return new CampaignEntity(props.campaignBaseInformations, filters, props.channel);
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

  public static async createNew(props: CRUDCampaignDTO): Promise<CampaignEntity> {
    return this.createFromPersistence({ ...props});
  }
}