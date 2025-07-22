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
import IFiltersRepository from "../../domain/contracts/repositories/IFiltersRepository";
import { NotRecipient } from "../../domain/entities/interfaces/not-recipient.interface";
import { WhereOptions } from "sequelize";
import StatisticsEmailCampaignRepository from "../../infrastructure/repositories/statistics-email-campaign.repository";
import StatisticsWhatsCampaignRepository from "../../infrastructure/repositories/statistics-whats-campaign.repository";

export default class SaveCampaignUseCase implements ISaveCampaignUseCase{

    constructor(
        private campaignRepository: ICampaignRepository,
        private recipientGroupRepository: RecipientGroupRepository,
        private filtersRepository: IFiltersRepository,
        private filterService: IFilterService,
        private emailStatisticsRepository: StatisticsEmailCampaignRepository,
        private whatsStatisticsRepository: StatisticsWhatsCampaignRepository,
    ){}

    public async execute(dto: CRUDCampaignDTO): Promise<Campaign | NotRecipient> {
        console.log('Inicio - apenas DTO: ', dto);
        
        const campaignEntity: CampaignEntity = await CampaignFactory.createNew(dto);
        console.log('Entidade criada');

        if (!campaignEntity.validateCreation()) throw new Error('Nome, assunto, status e e-mail do remetente são obrigatórios para criar campanha');
        
        const dataToSave: DataToSave = await campaignEntity.whatsIShouldSave();
        console.log('Dados de persistência criados e em mãos: ', dataToSave);
        let recipientGroupCount: number = 0;

        if(dataToSave.filters) {
            let responses: {
                whereClause?: WhereOptions;
                filterStep?: any;
            } = {};
            
            const { activeFiltersKey, activeFiltersValues } = dataToSave.filters;

            // Salva os filtros da campanha em tabelas associativas com CampaignId + Criar a clausula Where para a consulta do grupo destinatário na tabela de beneficiários
            const {whereClause, filterSteps } = await this.filterService.processToBuildVerificationIfHasBeneficiary(activeFiltersKey, activeFiltersValues);
            console.log('Veja após as manipulações: ', whereClause, filterSteps);
            
            responses.filterStep = filterSteps;

            const diagnostics = await this.recipientGroupRepository.getFilterDiagnostics(filterSteps);

            console.log('Diagnóstico de filtros aplicado:', diagnostics);
            diagnostics.report.forEach(msg => console.log(msg));

            let filterNoHasRecipient: string[] | string = diagnostics.report.filter(item => item.includes('0 r'));

            recipientGroupCount = diagnostics.totalFinal;

            // filterNoHasRecipient = filterNoHasRecipient[0].split('❌')[1]?.split(':')[0]?.trim();
            // console.log('Vê se deu certo a manipulação do retorno');
            
            if(filterNoHasRecipient.length > 0) {
                return {
                    message: filterNoHasRecipient[0]
                };
            }
        }

        const campaignSaved: Campaign = await this.campaignRepository.save(dataToSave.campaign);
        console.log('Informações base da campanha persistido');

        if(!campaignSaved.id) throw new Error('Retorno de save campaign sem ID... erro!');
        
        if (campaignSaved) campaignEntity.setId(campaignSaved.id);
        
        if (!campaignEntity.baseInformations.id) throw new Error('ID da entidade campanha não foi definido!');

        const response: SaveDTO = {campaign: campaignSaved};
        console.log('Começo do DTO de retorno do useCase: ', response);

        if (dataToSave.filters) {
            const { activeFiltersKey, activeFiltersValues } = dataToSave.filters;

            // Salva os filtros da campanha em tabelas associativas com CampaignId + Criar a clausula Where para a consulta do grupo destinatário na tabela de beneficiários
            const {filterResults, whereClause, filterSteps } = await this.filterService.processFiltersToSave(campaignEntity.baseInformations.id, activeFiltersKey, activeFiltersValues);
            console.log('Filtros persistidos e clausula de busca do grupo destinatário criada:', filterResults, whereClause, filterSteps);
            
            Object.assign(response, filterResults);
            response.whereClause = whereClause;

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

        // if (dataToSave.schedule && emailCampaignEntity.id) {
        //     const scheduleDB = await this.emailScheduleRepository.save(emailCampaignEntity.id, dataToSave.schedule);
        //     response.schedule = scheduleDB;
        // }

        // Realiza a busca do grupo destinatário na tabela de beneficiário.
        if (response.whereClause) {
            const recipientGroupDB: Partial<RecipientGroup>[] | string = await this.recipientGroupRepository.getRecipientsByFilters(response.whereClause);
            console.log('Busca por Grupo destinatário na tabela de beneficiário realizada com sucesso: ', recipientGroupDB);

            //  Caso não tenha grupo destinatário para os filtros criados retornamos uma string informando a situação.
            if (typeof recipientGroupDB === 'string') {
                console.log('Não tem nada e vai retornar sucesso porém sem grupo destinatário');
                
                response.notRecipientGroup = recipientGroupDB;
            } else {
                console.log('Tem grupo destinatário');
                
                response.recipientGroup = recipientGroupDB;
            }
        }

        // Salvamos o grupo destinatário da campanha em questão passando os dados e o id da campanha para associação
        if(response.recipientGroup && Array.isArray(response.recipientGroup) && response.recipientGroup.length > 0) {
            const recipientGroupSaved: RecipientGroup[] = await this.recipientGroupRepository.saveRecipientsGroup(response.recipientGroup, campaignEntity.baseInformations.id);
            console.log('Grupo destinatário persistido com sucesso');
            
            response.recipientGroupSaved = recipientGroupSaved;

            if(campaignEntity.baseInformations.typeCampaign === 'email') {
                await this.emailStatisticsRepository.create(recipientGroupCount, campaignEntity.baseInformations.id);
            } else if(campaignEntity.baseInformations.typeCampaign === 'whatsapp'){
                await this.whatsStatisticsRepository.create(recipientGroupCount, campaignEntity.baseInformations.id);
            }
        }

        console.log('Resposta do DTO do useCase finalizado: ', response);
        return response.campaign;
    }
}