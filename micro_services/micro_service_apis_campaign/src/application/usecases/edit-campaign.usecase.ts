import { WhereOptions } from "sequelize";
import ICampaignRepository from "../../domain/contracts/repositories/ICampaignRepository";
import IFiltersRepository from "../../domain/contracts/repositories/IFiltersRepository";
import IFilterService from "../../domain/contracts/service/IFilterService";
import IEditCampaingUseCase from "../../domain/contracts/usecase/IEditEmailCampaignUseCase";
import CampaignEntity from "../../domain/entities/Campaign";
import DataToSave from "../../domain/entities/interfaces/data-to-save.interface";
import EditResponse from "../../domain/entities/interfaces/email-campaign/output/edit-response.interface";
import { NotRecipient } from "../../domain/entities/interfaces/not-recipient.interface";
import RecipientGroup from "../../domain/entities/interfaces/recipient-group.interface";
import CampaignFactory from "../../domain/factories/campaign-entity-factory";
import RecipientGroupRepository from "../../infrastructure/repositories/recipient-group.repository";
import CRUDCampaignDTO from "../../presentation/dtos/crud-campaign.dto";
import { BooleanFiltersFlags } from "../../domain/entities/interfaces/campaign-create.interface";
import StatisticsWhatsCampaignRepository from "../../infrastructure/repositories/statistics-whats-campaign.repository";
import StatisticsEmailCampaignRepository from "../../infrastructure/repositories/statistics-email-campaign.repository";

export default class EditCampaignUseCase implements IEditCampaingUseCase{

    constructor(
        private campaignRepository: ICampaignRepository,
        private recipientGroupRepository: RecipientGroupRepository,
        private filtersRepository: IFiltersRepository,
        private filterService: IFilterService,
        private emailStatisticsRepository: StatisticsEmailCampaignRepository,
        private whatsStatisticsRepository: StatisticsWhatsCampaignRepository,
    ){}

    public async execute(dto: CRUDCampaignDTO): Promise<EditResponse | NotRecipient> {
        console.log('Inicio - apenas DTO: ', dto);
        
        const campaignEntity: CampaignEntity = await CampaignFactory.createFromPersistence(dto);

        if (!campaignEntity.baseInformations.id) throw new Error('ID da campanha não foi definido!');
        if(!campaignEntity.canBeEdited()) throw new Error('Campanhas disparadas não podem ser salvas');

        const dataToUpdate: DataToSave = await campaignEntity.whatsIShouldSave();

        let recipientGroupCount: number = 0;

        if(dataToUpdate.filters) {
            let responses: {
                whereClause?: WhereOptions;
                filterStep?: any;
            } = {};
                    
            const { activeFiltersKey, activeFiltersValues } = dataToUpdate.filters;
        
            // Salva os filtros da campanha em tabelas associativas com CampaignId + Criar a clausula Where para a consulta do grupo destinatário na tabela de beneficiários
            const {whereClause, filterSteps } = await this.filterService.processToBuildVerificationIfHasBeneficiary(activeFiltersKey, activeFiltersValues);
            console.log('Veja após as manipulações: ', whereClause, filterSteps);
                    
            responses.whereClause = whereClause;
            responses.filterStep = filterSteps;
        
            const diagnostics = await this.recipientGroupRepository.getFilterDiagnostics(filterSteps);
        
            console.log('Diagnóstico de filtros aplicado:', diagnostics);
            diagnostics.report.forEach(msg => console.log(msg));
        
            let filterNoHasRecipient: string[] | string = diagnostics.report.filter(item => item.includes('retornando: 0 registro(s).'));
        
            // filterNoHasRecipient = filterNoHasRecipient[0].split('❌')[1]?.split(':')[0]?.trim();
            // console.log('Vê se deu certo a manipulação do retorno');
                    
            if(filterNoHasRecipient.length > 0) {
                return {
                    message: filterNoHasRecipient[0]
                };
            }

            recipientGroupCount = diagnostics.totalFinal;
        }

        // Tenho de pegar a campanha "antiga" para comparar com o payload atual
        const oldCampaign = await this.campaignRepository.findById(campaignEntity.baseInformations.id);
        let fieldsFilterBy: {key: string, value: any}[] = Object.entries(oldCampaign.campaign).filter(([key]) => key.startsWith('filterBy')).map(([key, value]) => ({key, value}));
        console.log('Resultado da manipulação do objeto: ', fieldsFilterBy);
        console.log('Vejamos o filtros atuais: ', dataToUpdate.filters);

        const currentFieldsFilterBy = dto.booleansFiltersFlags;
        console.log('Vejamos se o DTO serve - baseInfo: ', dto.campaignBaseInformations);

        // Passo 1: filtrar do 1º dado somente os que são true
        const filterTrueOnly = fieldsFilterBy.filter(({ value }) => value === true);

        // Passo 2: pegar correspondentes no 2º dado e comparar
        const diffs2 = filterTrueOnly.filter(({ key, value }) => currentFieldsFilterBy[key as keyof BooleanFiltersFlags] !== value);

        console.log("Somente TRUE do 1º dado:", filterTrueOnly);
        console.log("Diferenças:", diffs2);

        let campaignUpdated: string = await this.campaignRepository.update(dataToUpdate.campaign);

        if(campaignUpdated.includes('Falhou')) throw new Error(campaignUpdated);
        

        const response: EditResponse = {campaignUpdated, typeCampaign: campaignEntity.baseInformations.typeCampaign};

        if (dataToUpdate.filters) {
            const { activeFiltersKey, activeFiltersValues } = dataToUpdate.filters;

            const {filterResults, whereClause } = await this.filterService.processFiltersToEdit(campaignEntity.baseInformations.id, activeFiltersKey, activeFiltersValues, diffs2);
            
            Object.assign(response, filterResults);

            response.whereClause = whereClause;

            // console.log('Vamos analisar o final de tudo: ', response);
            console.log('Vamos analisar o DTO de retorno do useCase após persistencia dos filtros e whereClause: ', response);
            
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
            console.log('Antes de buscar o grupo destinatário: ', response.whereClause);
            
            const recipientGroupDB: Partial<RecipientGroup>[] | string = await this.recipientGroupRepository.getRecipientsByFilters(response.whereClause);
            console.log('Grupo destinatário alcançado: ', recipientGroupDB);
            

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
            console.log('Após salvar o grupo destinatário');
            
            response.recipientGroupSaved = savedResponse;

            // paramos no teste se ta atualizandoa as estatísticas VEEEEEEEJAAAAAAA - SEXTA 22-08
            console.log('Antes de atualizar as estatísticas');
            console.log('Vejamos as diferenças: ', diffs2.length);
            console.log('Vejamos o tipo da campanha: ', campaignEntity.baseInformations.typeCampaign);
            console.log('Quantas pessoas atingidas: ', recipientGroupCount);
            if(campaignEntity.baseInformations.typeCampaign === 'email' && (diffs2.length > 0 || dataToUpdate.filters?.activeFiltersKey && dataToUpdate.filters?.activeFiltersKey.length > 0)) {
                console.log('Entrou, vai atualizar as estatísticas');

                const responseUpdate = await this.emailStatisticsRepository.update(campaignEntity.baseInformations.id, recipientGroupCount);

                console.log('Vamos vê o retorno: ', responseUpdate);                
            } else if(campaignEntity.baseInformations.typeCampaign === 'whatsapp' && (diffs2.length > 0 || dataToUpdate.filters?.activeFiltersKey && dataToUpdate.filters?.activeFiltersKey.length > 0)){
                await this.whatsStatisticsRepository.updateRecipientGroupCount(campaignEntity.baseInformations.id, recipientGroupCount);
            }
        }

        return response;
    }
}