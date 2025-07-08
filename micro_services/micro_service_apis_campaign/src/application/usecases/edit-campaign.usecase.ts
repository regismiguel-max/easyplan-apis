import ICampaignRepository from "../../domain/contracts/repositories/ICampaignRepository";
import IFilterService from "../../domain/contracts/service/IFilterService";
import IEditCampaingUseCase from "../../domain/contracts/usecase/IEditEmailCampaignUseCase";
import CampaignEntity from "../../domain/entities/Campaign";
import DataToSave from "../../domain/entities/interfaces/data-to-save.interface";
import EditResponse from "../../domain/entities/interfaces/email-campaign/output/edit-response.interface";
import RecipientGroup from "../../domain/entities/interfaces/recipient-group.interface";
import CampaignFactory from "../../domain/factories/campaign-entity-factory";
import RecipientGroupRepository from "../../infrastructure/repositories/recipient-group.repository";
import CRUDCampaignDTO from "../../presentation/dtos/crud-campaign.dto";

export default class EditCampaignUseCase implements IEditCampaingUseCase{

    constructor(
        private campaignRepository: ICampaignRepository,
        private recipientGroupRepository: RecipientGroupRepository,
        private filterService: IFilterService
    ){}

    public async execute(dto: CRUDCampaignDTO): Promise<EditResponse> {
        console.log('Inicio - apenas DTO: ', dto);
        
        const campaignEntity: CampaignEntity = await CampaignFactory.createFromPersistence(dto);

        if (!campaignEntity.baseInformations.id) throw new Error('ID da campanha não foi definido!');
        if(!campaignEntity.canBeEdited()) throw new Error('Campanhas disparadas não podem ser salvas');

        const dataToUpdate: DataToSave = await campaignEntity.whatsIShouldSave();

        let campaignUpdated: string = await this.campaignRepository.update(dataToUpdate.campaign);

        if(campaignUpdated.includes('Falhou')) throw new Error(campaignUpdated);
        

        const response: EditResponse = {campaignUpdated, typeCampaign: campaignEntity.baseInformations.typeCampaign};

        if (dataToUpdate.filters) {
            const { activeFiltersKey, activeFiltersValues } = dataToUpdate.filters;

            const {filterResults, whereClause } = await this.filterService.processFiltersToEdit(campaignEntity.baseInformations.id, activeFiltersKey, activeFiltersValues);
            
            Object.assign(response, filterResults);

            response.whereClause = whereClause;

            console.log('Vamos analisar o final de tudo: ', response);
            
            // Buscar e contar destinatários com base nos filtros
            // try {
            //     // Contar destinatários (mais eficiente que buscar todos)
            //     const recipientCount = await this.emailCampaignRepository.countByFilters(whereClause);
            //     response.recipientCount = recipientCount;
                
            //     // Opcionalmente, buscar uma amostra dos destinatários
            //     // Se você precisar dos dados completos, pode buscar com paginação
            //     if (recipientCount > 0) { // Limite para evitar sobrecarga
            //         const recipients = await this.emailCampaignRepository.findByFilters(whereClause);
            //         response.recipients = recipients;
            //     }
            // } catch (error) {
            //     console.error("Erro ao buscar destinatários:", error);
            //     // Não falhar o caso de uso por causa disso, apenas registrar o erro
            //     response.recipientError = "Falha ao buscar destinatários";
            // }
        }

        // if (dataToUpdate.schedule && emailCampaignEntity.id) {
        //     const scheduleDB = await this.emailScheduleRepository.save(emailCampaignEntity.id, dataToSave.schedule);
        //     response.schedule = scheduleDB;
        // }

        if (response.whereClause) {
            const recipientGroupDB: Partial<RecipientGroup>[] | string = await this.recipientGroupRepository.getRecipientsByFilters(response.whereClause);

            if (typeof recipientGroupDB === 'string') {
                console.log('Não tem nada e vai retornar sucesso porém sem grupo destinatário');
                
                response.notRecipientGroup = recipientGroupDB;
            } else {
                response.recipientGroup = recipientGroupDB;
            }
        }

         // caso os novos filtros não retornem grupo destinatário
        if(response.notRecipientGroup) {
            console.log('Vai deletar o que tiver de grupo destinatário');
            
            //deleteRecipientsGroup é seguro de ser chamado independentemente de existir ou não grupo destinatário.
            const deleteResponse: string = await this.recipientGroupRepository.deleteRecipientsGroup(campaignEntity.baseInformations.id);

            if(deleteResponse.includes('Falha')) throw new Error(deleteResponse);
        }

        // caso os novos filtros retornem grupo destinatário
        if(response.recipientGroup && Array.isArray(response.recipientGroup) && response.recipientGroup.length > 0) {
            console.log('Só para confirmar');
                    
            const deleteResponse: string = await this.recipientGroupRepository.deleteRecipientsGroup(campaignEntity.baseInformations.id);
        
            if(deleteResponse.includes('Falha')) throw new Error(deleteResponse);
        
            const savedResponse: RecipientGroup[] = await this.recipientGroupRepository.saveRecipientsGroup(response.recipientGroup, campaignEntity.baseInformations.id);
                
            response.recipientGroupSaved = savedResponse;
        }

        return response;
    }
}