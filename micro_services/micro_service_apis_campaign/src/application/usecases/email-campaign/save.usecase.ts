import IEmailCampaignRepository from "../../../domain/contracts/repositories/IEmailCampaignRepository";
import ISaveEmailCampaignUseCase from "../../../domain/contracts/usecase/ISaveEmailCampaignUseCase.interface";
import EmailCampaignEntity from "../../../domain/entities/EmailCampaign";
import { EmailCampaignFactory } from "../../../domain/factories/entity-email-campaign-factory";
import CRUDEmailCampaignDTO from "../../../presentation/dtos/email-campaign/input/crud-email-campaign.dto";
import IEmailScheduleRepository from "../../repositories-interfaces/email-schedule.repository";
import IFilterService from "../../../domain/contracts/service/IFilterService";
import DataToSave from "../../../domain/entities/interfaces/email-campaign/data-to-save.interface";
import EmailCampaign from "../../../domain/entities/interfaces/email-campaign/email-campaign.interface";
import SaveResponse from "../../../domain/entities/interfaces/email-campaign/output/save-response.interface";
import RecipientGroup from "../../../domain/entities/interfaces/email-campaign/recipient-group.interface";
class SaveEmailCampaignUseCase implements ISaveEmailCampaignUseCase{

    constructor(
        private emailCampaignRepository: IEmailCampaignRepository,
        // private emailFiltersRepository: IEmailFiltersRepository,
        private emailScheduleRepository: IEmailScheduleRepository,
        // private filterStrategyFactory: FilterStrategyFactory,
        private filterService: IFilterService
    ){}

    public async execute(dto: CRUDEmailCampaignDTO): Promise<SaveResponse> {
        console.log('Inicio - apenas DTO: ', dto);
        
        const emailCampaignEntity: EmailCampaignEntity = await EmailCampaignFactory.createNew(dto);

        if (!emailCampaignEntity.validateCreation()) throw new Error('Nome, assunto, status e e-mail do remetente são obrigatórios para criar campanha');

        const dataToSave: DataToSave = await emailCampaignEntity.whatsIShouldSave();

        const emailCampaignSaved: EmailCampaign = await this.emailCampaignRepository.save(dataToSave.campaign);
        
        if(!emailCampaignSaved.id) throw new Error('Retorno de save campaign sem ID... erro!');
        
        if (emailCampaignSaved) emailCampaignEntity.setId(emailCampaignSaved.id);

        const response: SaveResponse = {emailCampaign: emailCampaignSaved};

        if (dataToSave.filters) {
            const { activeFiltersKey, activeFiltersValues } = dataToSave.filters;
            
            if (!emailCampaignEntity.emailCampaignBaseInformations.id) throw new Error('ID da campanha não foi definido!');

            const {filterResults, whereClause } = await this.filterService.processFiltersToSave(emailCampaignEntity.emailCampaignBaseInformations.id, activeFiltersKey, activeFiltersValues);
            
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
            const recipientGroupDB: Partial<RecipientGroup>[] | string = await this.emailCampaignRepository.getRecipientsByFilters(response.whereClause);

            if (typeof recipientGroupDB === 'string') {
                console.log('Não tem nada e vai retornar sucesso porém sem grupo destinatário');
                
                response.notRecipientGroup = recipientGroupDB;
            } else {
                response.recipientGroup = recipientGroupDB;
            }
        }

        if(!emailCampaignEntity.emailCampaignBaseInformations.id) throw new Error('EmailCampaignEntity sem ID... erro!');

        if(response.recipientGroup && Array.isArray(response.recipientGroup) && response.recipientGroup.length > 0) {
            console.log('Só pra confirmar rsrs');
            
            const recipientGroupSaved: RecipientGroup[] = await this.emailCampaignRepository.saveRecipientsGroup(response.recipientGroup, emailCampaignEntity.emailCampaignBaseInformations.id);

            response.recipientGroupSaved = recipientGroupSaved;
        }

        return response;
    }
}

export default SaveEmailCampaignUseCase;