import ICampaignRepository from "../../domain/contracts/repositories/ICampaignRepository";
import IFilterService from "../../domain/contracts/service/IFilterService";
import ISaveCampaignUseCase from "../../domain/contracts/usecase/ISaveCampaignUseCase.interface";
import CampaignEntity from "../../domain/entities/Campaign";
import Campaign from "../../domain/entities/interfaces/campaign.interface";
import DataToSave from "../../domain/entities/interfaces/data-to-save.interface";
import SaveDTO from "../../domain/entities/interfaces/save-dto.interface";
import RecipientGroup from "../../domain/entities/interfaces/recipient-group.interface";
import CampaignFactory from "../../domain/factories/campaign-entity-factory";
import RecipientGroupRepository from "../../infrastructure/repositories/recipient-group.repository";
import CRUDCampaignDTO from "../../presentation/dtos/crud-campaign.dto";

export default class SaveCampaignUseCase implements ISaveCampaignUseCase{

    constructor(
        private campaignRepository: ICampaignRepository,
        private recipientGroupRepository: RecipientGroupRepository,
        private filterService: IFilterService
    ){}

    public async execute(dto: CRUDCampaignDTO): Promise<Campaign> {
        console.log('Inicio - apenas DTO: ', dto);
        
        const campaignEntity: CampaignEntity = await CampaignFactory.createNew(dto);

        if (!campaignEntity.validateCreation()) throw new Error('Nome, assunto, status e e-mail do remetente são obrigatórios para criar campanha');

        const dataToSave: DataToSave = await campaignEntity.whatsIShouldSave();

        const campaignSaved: Campaign = await this.campaignRepository.save(dataToSave.campaign);

        if(!campaignSaved.id) throw new Error('Retorno de save campaign sem ID... erro!');
        
        if (campaignSaved) campaignEntity.setId(campaignSaved.id);
        
        if (!campaignEntity.baseInformations.id) throw new Error('ID da entidade campanha não foi definido!');

        const response: SaveDTO = {campaign: campaignSaved};

        if (dataToSave.filters) {
            const { activeFiltersKey, activeFiltersValues } = dataToSave.filters;

            const {filterResults, whereClause } = await this.filterService.processFiltersToSave(campaignEntity.baseInformations.id, activeFiltersKey, activeFiltersValues);
            
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

        // if (dataToSave.schedule && emailCampaignEntity.id) {
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

        if(response.recipientGroup && Array.isArray(response.recipientGroup) && response.recipientGroup.length > 0) {
            console.log('Só pra confirmar rsrs');
            
            const recipientGroupSaved: RecipientGroup[] = await this.recipientGroupRepository.saveRecipientsGroup(response.recipientGroup, campaignEntity.baseInformations.id);

            response.recipientGroupSaved = recipientGroupSaved;
        }

        return response.campaign;
    }
}