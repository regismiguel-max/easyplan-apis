import IFiltersRepository from "../../domain/contracts/repositories/IFiltersRepository";
import AgeRangeModel from "../database/models/filters/age-range.models";
import EmailModalityModel from "../database/models/associations/campaign-modality.models";
import CampaignUfsModel from "../database/models/associations/campaign-ufs.models";
import ValidityModel from "../database/models/filters/validity.model";
import OperatorsModel from "../database/models/filters/operators.models";
import PlansModel from "../database/models/filters/plans.models";
import ContractStatusModel from "../database/models/filters/contract-status.models";
import ModalityModel from "../database/models/filters/modality.models";
import UfModel from "../database/models/filters/uf.models";
import Operator from "../../domain/entities/interfaces/filters/operator.interface";
import Plan from "../../domain/entities/interfaces/filters/plan.interface";
import ContractStatus from "../../domain/entities/interfaces/filters/contract-status.interface";
import Uf from "../../domain/entities/interfaces/filters/uf.interface";
import OperatorEmailAssociation from "../../domain/entities/interfaces/associations/operator-email.interface";
import PlanEmailAssociation from "../../domain/entities/interfaces/associations/plan-email.interface";
import ContractStatusEmailAssociation from "../../domain/entities/interfaces/associations/contract-status-email.interface";
import UfEmailAssociation from "../../domain/entities/interfaces/associations/uf-email.interface";
import AgeRange from "../../domain/entities/interfaces/filters/age-range.interface";
import Validity from "../../domain/entities/interfaces/filters/validity.interface";
import CampaignPlansModel from "../database/models/associations/campaign-plans.model";
import CampaignOperatorsModel from "../database/models/associations/campaign-operators.models";
import CampaignContractStatusModel from "../database/models/associations/campaign-contract-status.models";
import CampaignModalityModel from "../database/models/associations/campaign-modality.models";
import BirthModel from "../database/models/associations/campaign-birth.models";
import Birth from "../../domain/entities/interfaces/filters/birth.interface";
import BirthDTOPersistence from "../../domain/entities/interfaces/birth-dto-persistence.interface";
// import ContractStatusModel from "./models/contract-status.models";
// import ModalityModel from "./models/modality.models";
// import OperatorsModel from "./models/operators.models";
// import PlansModel from "./models/plans.models";
// import UfModel from "./models/uf.models";

export default class FiltersRepository implements IFiltersRepository {
    /*********************************** SAVE - TABELAS ASSOCIATIVAS DE FILTROS + EMAILCAMPAIGN ***********************************/
    async saveCampaignOperators(campaignId: number, operatorIds: number[]): Promise<OperatorEmailAssociation[]> {   
        const data = operatorIds.map((operatorId) => ({
            campaignId: campaignId,
            operatorId: operatorId,
        }));
        
        const campaignOperatorsDB = await CampaignOperatorsModel.bulkCreate(data);

        const campaignOperators = campaignOperatorsDB.map(campaignOperator => campaignOperator.get({plain: true})) as OperatorEmailAssociation[];

        console.log('Retorno campaign - Operator após manipulação: ', campaignOperators);

        return campaignOperators;
    }
    async saveCampaignBirth(campaignId: number, birthData: BirthDTOPersistence): Promise<Birth> {   
        console.log('Vamos vê a data: ', birthData);
        
        const birthDB = await BirthModel.create({
            campaignId,
            day: birthData.day,
            month: birthData.month,
            year: birthData.year
        });

        const birth = birthDB.get({plain: true}) as Birth;

        console.log('Retorno campaign - Birth após manipulação: ', birth);

        return birth;
    }

    async saveCampaignPlans(campaignId: number, planIds: number[]): Promise<PlanEmailAssociation[]> {
        const data = planIds.map((planId) => ({
            campaignId: campaignId,
            planId: planId,
        }));

        const campaignPlansDB = await CampaignPlansModel.bulkCreate(data);

        const campaignPlans = campaignPlansDB.map(campaignPlan => campaignPlan.get({plain: true}));

        console.log('Retorno campaign - Plan após manipulação: ', campaignPlans);

        return campaignPlans;
    }

    async saveCampaignContractStatus(campaignId: number, contractStatusIds: number[]): Promise<ContractStatusEmailAssociation[]> {
        const data = contractStatusIds.map((contractStatusId) => ({
            campaignId: campaignId,
            contractStatusId: contractStatusId,
        }));

        const campaignContractStatusesDB = await CampaignContractStatusModel.bulkCreate(data);

        const campaignContractStatuses = campaignContractStatusesDB.map(contractStatus => contractStatus.get({plain: true}));

        console.log('Retorno Email - Contract após manipulação: ', campaignContractStatuses);

        return campaignContractStatuses;
    }

    async saveCampaignModality(campaignId: number, modalityIds: number[]): Promise<any[]> {
        const data = modalityIds.map((modalityId) => ({
            campaignId: campaignId,
            modalityId: modalityId,
        }));

        const campaignModalitiesDB = await CampaignModalityModel.bulkCreate(data);

        const campaignModalities = campaignModalitiesDB.map(campaignModality => campaignModality.get({plain: true}));

        console.log('Retorno campaign - Modality após manipulação: ', campaignModalities);

        return campaignModalities;
    }

    async saveCampaignUf(campaignId: number, ufIds: number[]): Promise<UfEmailAssociation[]> {
        const data = ufIds.map((ufId) => ({
            campaignId: campaignId,
            ufId: ufId,
        }));

        const campaignUfsDB = await CampaignUfsModel.bulkCreate(data);

        const campaignUfs = campaignUfsDB.map(campaignUf => campaignUf.get({plain: true}));

        console.log('Retorno campaign - Operator após manipulação: ', campaignUfs);

        return campaignUfs;
    }

    async saveCampaignAgeRange(campaignId: number, ageRange: number[]): Promise<AgeRange> {
        const emailAgeRangesDB = await AgeRangeModel.create({
            min: ageRange[0],
            max: ageRange[1],
            campaignId: campaignId,
        });

        const emailAgeRange = emailAgeRangesDB.get({plain: true}) as AgeRange;

        console.log('Retorno Email - Operator após manipulação: ', emailAgeRange);

        return emailAgeRange;
    }

    async saveCampaignValidity(campaignId: number, validity: string[]): Promise<Validity> {
        const emailValidityDB = await ValidityModel.create({
            start: validity[0],
            end: validity[1],
            campaignId: campaignId,
        });

        const emailValidity = emailValidityDB.get({plain: true}) as Validity;

        console.log('Retorno Email - Operator após manipulação: ', emailValidity);

        return emailValidity;
    }

    /*********************************** DELETE - TABELAS ASSOCIATIVAS DE FILTROS + EMAILCAMPAIGN ***********************************/
    async deleteAllFiltersByCampaignId(campaignId: number): Promise<void> {
        if(!campaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const models = [
            { name: 'Operators', model: CampaignOperatorsModel },
            { name: 'Plans', model: CampaignPlansModel },
            { name: 'ContractStatus', model: CampaignContractStatusModel },
            { name: 'Modality', model: CampaignModalityModel },
            { name: 'Ufs', model: CampaignUfsModel },
            { name: 'AgeRange', model: AgeRangeModel },
            { name: 'Validity', model: ValidityModel },
            { name: 'Birth', model: BirthModel },
        ];
        
        try {
            for (const { model } of models) {
                await model.destroy({ where: { campaignId } });
            }
        } catch (error) {
            throw new Error(`Ocorreu algum erro na exclusão das tabelas associativas: ${error}`)
        }

        console.log('Todos os filtros foram deletados com sucesso');
    }
      
    async deleteCampaignOperators(campaignId: number): Promise<any | void> {
        try {
            if(!campaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');
            
            const exist = await CampaignOperatorsModel.count({ where: { campaignId } })
            
            if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

            const deleteCampaignOperatorsResult = await CampaignOperatorsModel.destroy({where: {campaignId}});
    
            if(deleteCampaignOperatorsResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
            
            return `operators - Deleção realizada com sucesso. ${deleteCampaignOperatorsResult} foram deletadas.`
        } catch (error) {
            console.log('Erro ao deleter emailOperator: ', error);
        }
    }

    async deleteCampaignPlans(campaignId: number): Promise<string | void> {
        if(!campaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await CampaignPlansModel.count({ where: { campaignId } })
            
        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const deleteCampaignPlansResult = await CampaignPlansModel.destroy({where: {campaignId}});

        if(deleteCampaignPlansResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
        
        return `plans - Deleção realizada com sucesso. ${deleteCampaignPlansResult} foram deletadas.`
    }

    async deleteCampaignContractStatus(campaignId: number): Promise<string | void> {
        if(!campaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await CampaignContractStatusModel.count({ where: { campaignId } })
            
        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const deleteCampaignContractStatusesResult = await CampaignContractStatusModel.destroy({where: {campaignId}});

        if(deleteCampaignContractStatusesResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
        
        return `contractStatus - Deleção realizada com sucesso. ${deleteCampaignContractStatusesResult} foram deletadas.`
    }

    async deleteCampaignModality(campaignId: number): Promise<string | void> {
        if(!campaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await CampaignModalityModel.count({ where: { campaignId } })
            
        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const deleteCampaignModalitiesResult = await EmailModalityModel.destroy({where: {campaignId}});

        if(deleteCampaignModalitiesResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
        
        return `modality - Deleção realizada com sucesso. ${deleteCampaignModalitiesResult} foram deletadas.`
    }

    async deleteCampaignUf(campaignId: number): Promise<string | void> {
        if(!campaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await CampaignUfsModel.count({ where: { campaignId } });
            
        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const deleteCampaignUfsResult = await CampaignUfsModel.destroy({where: {campaignId}});

        if(deleteCampaignUfsResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
        
        return `uf - Deleção realizada com sucesso. ${deleteCampaignUfsResult} linhas foram deletadas.`;
    }

    async deleteCampaignAgeRange(campaignId: number): Promise<string | void> {
        if(!campaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await AgeRangeModel.count({ where: { campaignId } })
            
        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const deleteCampaignAgeRangeResult = await AgeRangeModel.destroy({where: {campaignId}});

        if(deleteCampaignAgeRangeResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
        
        return `Deleção realizada com sucesso. ${deleteCampaignAgeRangeResult} foram deletadas.`
    }

    async deleteCampaignBirth(campaignId: number): Promise<string | void> {
        if(!campaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await BirthModel.count({ where: { campaignId } })
            
        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const deleteCampaignBirthResult = await BirthModel.destroy({where: {campaignId}});

        if(deleteCampaignBirthResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
        
        return `Deleção realizada com sucesso. ${deleteCampaignBirthResult} foram deletadas.`
    }

    async deleteCampaignValidity(campaignId: number): Promise<string | void> {
        if(!campaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await ValidityModel.count({ where: { campaignId } })
            
        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const deleteCampaignValidityResult = await ValidityModel.destroy({where: {campaignId}});

        if(deleteCampaignValidityResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
        
        return `Deleção realizada com sucesso. ${deleteCampaignValidityResult} foram deletadas.`
    }

    // vai ficar dentro do scopo de deleção pois faz parte da lógica
    async updateEmailAgeRange(emailCampaignId: number, ageRange: number[]): Promise<string> {
        if(!emailCampaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await AgeRangeModel.count({ where: { emailCampaignId }});

        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const emailAgeRangesDB = await AgeRangeModel.update(
            {
                min: ageRange[0],
                max: ageRange[1],
            },
            {
                where: {emailCampaignId}
            }
        );

        if (emailAgeRangesDB.length <= 0) throw new Error('Erro - Nenhuma linha foi ataulzida do banco de dados');

        return `ageRange - Atualização realizada com sucesso. ${emailAgeRangesDB.length} linhas foram atualizadas.`;
    }

    /************************************ GET - TABELAS BASE DE FILTROS *******************************************/
    //********** OPERADORAS **********
    async getOperators(): Promise<Operator[]> {
        const operatorsDB = await OperatorsModel.findAll();

        if (!operatorsDB) throw new Error('Deu erro ao buscar as operadoras');
        
        let operators: Operator[] = [];
        
        operatorsDB.forEach(oDB => {
            const pureObject = oDB.get({plain: true});

            operators.push(pureObject);
        })

        return operators;
    }
    async getOperatorById(id: number): Promise<Operator> {
        const operatorDB = await OperatorsModel.findByPk(id);

        if (!operatorDB) throw new Error('Deu erro ao buscar as operadoras');

        const pureObject: Operator = operatorDB.get({plain: true});

        console.log('Resultado final do repository: ', pureObject);

        return pureObject;
    }

    //********** PLANOS ************
    async getPlans(): Promise<Plan[]> {
        const plansDB = await PlansModel.findAll();

        if (!plansDB) throw new Error('Deu erro ao buscar as operadoras');

        let plans: Plan[] = [];

        plansDB.forEach(planDB => {
            const pureObject: Plan = planDB.get({plain: true});

            plans.push(pureObject);
        })
        
        return plans;
    }
    async getPlansByOperators(codigo_produto: string): Promise<Plan[]> {
        const plansDB = await PlansModel.findAll({
            where: {
                codigo_produto
            }
        });

        if (!plansDB) throw new Error('Deu erro ao buscar as operadoras');

        let plans: Plan[] = [];

        plansDB.forEach(pDB => {
            const pureObject: Plan = pDB.get({plain: true});

            plans.push(pureObject);
        })

        return plans;
    }
    async getPlanById(id: number): Promise<Plan> {
        const planDB = await PlansModel.findByPk(id);

        if (!planDB) throw new Error('Deu erro ao buscar o plano');

        const pureObject: Plan = planDB.get({plain: true});

        console.log('Resultado final do repository: ', pureObject);

        return pureObject;
    }
    
    //********** STATUS CONTRATO **********
    async getContractStatuses(): Promise<ContractStatus[]> {
        const contractStatusesDB = await ContractStatusModel.findAll();
        
        if (!contractStatusesDB) throw new Error('Deu erro ao buscar as operadoras');
        
        let contractStatuses: ContractStatus[] = [];
        
        contractStatusesDB.forEach(csDB => {
            const pureObject: ContractStatus = csDB.get({plain: true});
            
            contractStatuses.push(pureObject);
        })

        return contractStatuses;
    }
    async getContractStatusById(id: number): Promise<ContractStatus> {
        const contractStatusDB = await ContractStatusModel.findByPk(id);

        if (!contractStatusDB) throw new Error('Deu erro ao buscar o Status Contrato');

        const pureObject: ContractStatus = contractStatusDB.get({plain: true});

        console.log('Resultado final do repository: ', pureObject);

        return pureObject;
    }

    //*********** MODALIDADE ************
    async getModalities() {
        const modalitiesDB = await ModalityModel.findAll();
        
        if (!modalitiesDB) throw new Error('Deu erro ao buscar as operadoras');
        
        let modalities: any[] = [];
        
        modalitiesDB.forEach(mDB => {
            const pureObject = mDB.get({plain: true});
            
            modalities.push(pureObject);
        });
        
        // console.log('Modality - Query realizada com sucesso e retorno manipulado: ', modalities);
        console.log('Modality - Query realizada com sucesso e retorno manipulado: ');
        
        return modalities;
    }
    async getModalityById(id: number): Promise<any> {
        const modalityDB = await ModalityModel.findByPk(id);

        if (!modalityDB) throw new Error('Deu erro ao buscar a Modalidade');

        const pureObject = modalityDB.get({plain: true});

        return pureObject;
    }
    
    //*********** UF *************
    async getUfs(): Promise<Uf[]> {
        const ufsDB = await UfModel.findAll();

        if (!ufsDB) throw new Error('Deu erro ao buscar as operadoras');

        let ufs: Uf[] = [];

        ufsDB.forEach(uDB => {
            const pureObject: Uf = uDB.get({plain: true});
            
            ufs.push(pureObject);
        });
        
        return ufs;
    }
    async getUfById(id: number): Promise<Uf> {
        const ufDB = await UfModel.findByPk(id);

        if (!ufDB) throw new Error('Deu erro ao buscar a UF');

        const pureObject: Uf = ufDB.get({plain: true});

        console.log('Resultado final do repository: ', pureObject);

        return pureObject;
    }

    //************ FAIXA ETÁRIA **************
    async getAgeRangeById(id: number): Promise<AgeRange> {
        const ageRangeDB = await AgeRangeModel.findByPk(id);

        if (!ageRangeDB) throw new Error('Deu erro ao buscar a Faixa Etária');

        const pureObject = ageRangeDB.get({plain: true});

        console.log('Resultado final do repository: ', pureObject);

        return pureObject;
    }

    //************ VIGÊNCIA **************
    async getValidityById(id: number): Promise<Validity> {
        const validityDB = await ValidityModel.findByPk(id);

        if (!validityDB) throw new Error('Deu erro ao buscar a Vigência');

        const pureObject = validityDB.get({plain: true});

        console.log('Resultado final do repository: ', pureObject);

        return pureObject;
    }

    async getBirthById(id: number): Promise<Birth>{
        const birthDB = await BirthModel.findByPk(id);

        if (!birthDB) throw new Error('Deu erro ao buscar a Vigência');

        const pureObject = birthDB?.get({plain: true}) as Birth;

        return pureObject;
    }
}
