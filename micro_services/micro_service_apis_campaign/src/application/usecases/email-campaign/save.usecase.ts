// import IEmailCampaignRepository from "../../../domain/contracts/repositories/IEmailCampaignRepository";
// import ISaveCampaignUseCase from "../../../domain/contracts/usecase/ISaveEmailCampaignUseCase.interface";
// import CampaignEntity from "../../../domain/entities/Campaign";
// import CampaignFactory from "../../../domain/factories/campaign-entity-factory";
// import CRUDCampaignDTO from "../../../presentation/dtos/crud-campaign.dto";
// import IEmailScheduleRepository from "../../repositories-interfaces/email-schedule.repository";
// import IFilterService from "../../../domain/contracts/service/IFilterService";
// import DataToSave from "../../../domain/entities/interfaces/data-to-save.interface";
// import Campaign from "../../../domain/entities/interfaces/campaign.interface";
// import SaveResponse from "../../../domain/entities/interfaces/email-campaign/output/save-response.interface";
// import RecipientGroup from "../../../domain/entities/interfaces/recipient-group.interface";
// class SaveEmailCampaignUseCase implements ISaveCampaignUseCase{

//     constructor(
//         private emailCampaignRepository: IEmailCampaignRepository,
//         // private filtersRepository: IFiltersRepository,
//         private emailScheduleRepository: IEmailScheduleRepository,
//         // private filterStrategyFactory: FilterStrategyFactory,
//         private filterService: IFilterService
//     ){}

//     public async execute(dto: CRUDCampaignDTO): Promise<SaveResponse> {
//         console.log('Inicio - apenas DTO: ', dto);
        
//         const emailCampaignEntity: CampaignEntity = await CampaignFactory.createNew(dto);

//         if (!emailCampaignEntity.validateCreation()) throw new Error('Nome, assunto, status e e-mail do remetente são obrigatórios para criar campanha');

//         const emailDataToSave: DataToSave = await emailCampaignEntity.whatsIShouldSave();

//         if(!emailDataToSave.campaign.subject) throw new Error('Campanha de E-mail sem subject');

//         const emailCampaignSaved: Campaign = await this.emailCampaignRepository.save(emailDataToSave.campaign);
        
//         if(!emailCampaignSaved.id) throw new Error('Retorno de save campaign sem ID... erro!');
        
//         if (emailCampaignSaved) emailCampaignEntity.setId(emailCampaignSaved.id);

//         const response: SaveResponse = {emailCampaign: emailCampaignSaved};

//         if (emailDataToSave.filters) {
//             const { activeFiltersKey, activeFiltersValues } = emailDataToSave.filters;
            
//             if (!emailCampaignEntity.baseInformations.id) throw new Error('ID da campanha não foi definido!');

//             const {filterResults, whereClause } = await this.filterService.processFiltersToSave(emailCampaignEntity.baseInformations.id, activeFiltersKey, activeFiltersValues);
            
//             Object.assign(response, filterResults);

//             response.whereClause = whereClause;

//             console.log('Vamos analisar o final de tudo: ', response);
            
//             // Buscar e contar destinatários com base nos filtros
//             // try {
//             //     // Contar destinatários (mais eficiente que buscar todos)
//             //     const recipientCount = await this.emailCampaignRepository.countByFilters(whereClause);
//             //     response.recipientCount = recipientCount;
                
//             //     // Opcionalmente, buscar uma amostra dos destinatários
//             //     // Se você precisar dos dados completos, pode buscar com paginação
//             //     if (recipientCount > 0) { // Limite para evitar sobrecarga
//             //         const recipients = await this.emailCampaignRepository.findByFilters(whereClause);
//             //         response.recipients = recipients;
//             //     }
//             // } catch (error) {
//             //     console.error("Erro ao buscar destinatários:", error);
//             //     // Não falhar o caso de uso por causa disso, apenas registrar o erro
//             //     response.recipientError = "Falha ao buscar destinatários";
//             // }
//         }

//         // if (emailDataToSave.schedule && emailCampaignEntity.id) {
//         //     const scheduleDB = await this.emailScheduleRepository.save(emailCampaignEntity.id, emailDataToSave.schedule);
//         //     response.schedule = scheduleDB;
//         // }

//         if (response.whereClause) {
//             const recipientGroupDB: Partial<RecipientGroup>[] | string = await this.emailCampaignRepository.getRecipientsByFilters(response.whereClause);

//             if (typeof recipientGroupDB === 'string') {
//                 console.log('Não tem nada e vai retornar sucesso porém sem grupo destinatário');
                
//                 response.notRecipientGroup = recipientGroupDB;
//             } else {
//                 response.recipientGroup = recipientGroupDB;
//             }
//         }

//         if(!emailCampaignEntity.baseInformations.id) throw new Error('EmailCampaignEntity sem ID... erro!');

//         if(response.recipientGroup && Array.isArray(response.recipientGroup) && response.recipientGroup.length > 0) {
//             console.log('Só pra confirmar rsrs');
            
//             const recipientGroupSaved: RecipientGroup[] = await this.emailCampaignRepository.saveRecipientsGroup(response.recipientGroup, emailCampaignEntity.baseInformations.id);

//             response.recipientGroupSaved = recipientGroupSaved;
//         }

//         return response;
//     }
// }

// export default SaveEmailCampaignUseCase;