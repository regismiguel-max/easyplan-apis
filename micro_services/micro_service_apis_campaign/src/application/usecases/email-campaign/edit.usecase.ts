// import IEditEmailCampaingUseCase from "../../../domain/contracts/usecase/IEditEmailCampaignUseCase";
// import CampaignEntity from "../../../domain/entities/Campaign";
// import DataToSave from "../../../domain/entities/interfaces/data-to-save.interface";
// import EditResponse from "../../../domain/entities/interfaces/email-campaign/output/edit-response.interface";
// import RecipientGroup from "../../../domain/entities/interfaces/recipient-group.interface";
// import CampaignFactory from "../../../domain/factories/campaign-entity-factory";
// import EmailCampaignRepository from "../../../infrastructure/repositories/email-campaign.repository";
// import CRUDCampaignDTO from "../../../presentation/dtos/crud-campaign.dto";
// import { FilterService } from "../../services/filter.service";

// export default class EditEmailCampaignUseCase implements IEditEmailCampaingUseCase {

//     constructor(
//         private emailCampaignRepository: EmailCampaignRepository,
//         private filterService: FilterService
//     ) {}

//     async execute(dto: CRUDCampaignDTO): Promise<EditResponse> {
//         // Transformar em entidade
//         const emailCampaignEntity: CampaignEntity = CampaignFactory.createFromPersistence(dto);

//         if (!emailCampaignEntity.baseInformations.id) throw new Error('ID da campanha não foi definido!');
//         if(!emailCampaignEntity.canBeEdited()) throw new Error('Campanhas disparadas não podem ser salvas');
        
//         const dataToUpdate: DataToSave = await emailCampaignEntity.whatsIShouldSave();

//         const updatedResponse: string = await this.emailCampaignRepository.update(dataToUpdate.campaign);

//         if(updatedResponse.includes('Falhou')) throw new Error(updatedResponse);

//         let response: EditResponse = {updatedResponse: updatedResponse};

//         if (dataToUpdate.filters) {
//             const { activeFiltersKey, activeFiltersValues } = dataToUpdate.filters;

//             const {filterResults, whereClause} = await this.filterService.processFiltersToEdit(emailCampaignEntity.baseInformations.id, activeFiltersKey, activeFiltersValues);
            
//             Object.assign(response, filterResults);

//             response.whereClause = whereClause;
//         }

//         // if (dataToUpdate.schedule && emailCampaignEntity.id) {
//         //     console.log('Tem agendamento selecionado para ser persistido, ou salvo ou atualizado');

//         //     const scheduleDB = await this.emailScheduleRepository.update(emailCampaignEntity.id, dataToUpdate.schedule);
//         //     console.log('Retorno do update de agendamento: ', scheduleDB);

//         //     if (scheduleDB?.includes('pode salvar')) {
//         //         const saveDB = await this.emailScheduleRepository.save(emailCampaignEntity.id, dataToUpdate.schedule);
                
//         //         response.schedule = saveDB;
//         //     }else {
//         //         response.schedule = scheduleDB;
//         //     }
//         //     console.log('Agendamento finalizado');
            
//         // }

//         // caso tenha query montada
//         if (response.whereClause) {
//             const recipientGroupDB: Partial<RecipientGroup>[] | string = await this.emailCampaignRepository.getRecipientsByFilters(response.whereClause);
        
//             if (typeof recipientGroupDB === 'string') {
//                 console.log('Não tem nada e vai retornar sucesso porém sem grupo destinatário');
//                 response.notRecipientGroup = recipientGroupDB;
//             } else {
//                 response.recipientGroup = recipientGroupDB;
//             }
//         }

//         // caso os novos filtros não retornem grupo destinatário
//         if(response.notRecipientGroup) {
//             console.log('Vai deletar o que tiver de grupo destinatário');
            
//             //deleteRecipientsGroup é seguro de ser chamado independentemente de existir ou não grupo destinatário.
//             const deleteResponse: string = await this.emailCampaignRepository.deleteRecipientsGroup(emailCampaignEntity.baseInformations.id);

//             if(deleteResponse.includes('Falha')) throw new Error(deleteResponse);
//         }
  
//         // caso os novos filtros retornem grupo destinatário
//         if(response.recipientGroup && Array.isArray(response.recipientGroup) && response.recipientGroup.length > 0) {
//             console.log('Só para confirmar');
            
//             const deleteResponse: string = await this.emailCampaignRepository.deleteRecipientsGroup(emailCampaignEntity.baseInformations.id);

//             if(deleteResponse.includes('Falha')) throw new Error(deleteResponse);

//             const savedResponse: RecipientGroup[] = await this.emailCampaignRepository.saveRecipientsGroup(response.recipientGroup, emailCampaignEntity.baseInformations.id);
        
//             response.recipientGroupSaved = savedResponse;
//         }

//         console.log('Veja o DTO de resposta final do useCase: ', response);

//         return response;
//     }
// }