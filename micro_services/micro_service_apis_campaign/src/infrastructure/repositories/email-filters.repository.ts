import { where } from "sequelize";
import IEmailFiltersRepository from "../../application/repositories-interfaces/email-filters.repository";
import AgeRangeModel from "../database/models/filters/age-range.models";
import EmailContractStatusModel from "../database/models/associations/email-contract-status.models";
import EmailModalityModel from "../database/models/associations/email-modality.models";
import EmailOperatorsModel from "../database/models/associations/email-operators.models";
import EmailPlansModel from "../database/models/associations/email-plans.model";
import EmailUfsModel from "../database/models/associations/email-ufs.models";
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
// import ContractStatusModel from "./models/contract-status.models";
// import ModalityModel from "./models/modality.models";
// import OperatorsModel from "./models/operators.models";
// import PlansModel from "./models/plans.models";
// import UfModel from "./models/uf.models";

export default class EmailFiltersRepository implements IEmailFiltersRepository {
    /*********************************** SAVE - TABELAS ASSOCIATIVAS DE FILTROS + EMAILCAMPAIGN ***********************************/
    async saveEmailOperators(campaignId: number, operatorIds: number[]): Promise<OperatorEmailAssociation[]> {   
        const data = operatorIds.map((operatorId) => ({
            emailCampaignId: campaignId,
            operatorId: operatorId,
        }));
        
        const emailOperatorsDB = await EmailOperatorsModel.bulkCreate(data);

        const emailOperators = emailOperatorsDB.map(emailOperator => emailOperator.get({plain: true})) as OperatorEmailAssociation[];

        console.log('Retorno Email - Operator após manipulação: ', emailOperators);

        return emailOperators;
    }

    async saveEmailPlans(campaignId: number, planIds: number[]): Promise<PlanEmailAssociation[]> {
        const data = planIds.map((planId) => ({
            emailCampaignId: campaignId,
            planId: planId,
        }));

        const emailPlansDB = await EmailPlansModel.bulkCreate(data);

        const emailPlans = emailPlansDB.map(emailPlan => emailPlan.get({plain: true}));

        console.log('Retorno Email - Plan após manipulação: ', emailPlans);

        return emailPlans;
    }

    async saveEmailContractStatus(campaignId: number, contractStatusIds: number[]): Promise<ContractStatusEmailAssociation[]> {
        const data = contractStatusIds.map((contractStatusId) => ({
            emailCampaignId: campaignId,
            contractStatusId: contractStatusId,
        }));

        const emailContractStatusesDB = await EmailContractStatusModel.bulkCreate(data);

        const emailContractStatuses = emailContractStatusesDB.map(contractStatus => contractStatus.get({plain: true}));

        console.log('Retorno Email - Contract após manipulação: ', emailContractStatuses);

        return emailContractStatuses;
    }

    async saveEmailModality(campaignId: number, modalityIds: number[]): Promise<any[]> {
        const data = modalityIds.map((modalityId) => ({
            emailCampaignId: campaignId,
            modalityId: modalityId,
        }));

        const emailModalitiesDB = await EmailModalityModel.bulkCreate(data);

        const emailModalities = emailModalitiesDB.map(emailModality => emailModality.get({plain: true}));

        console.log('Retorno Email - Modality após manipulação: ', emailModalities);

        return emailModalities;
    }

    async saveEmailUf(campaignId: number, ufIds: number[]): Promise<UfEmailAssociation[]> {
        const data = ufIds.map((ufId) => ({
            emailCampaignId: campaignId,
            ufId: ufId,
        }));

        const emailUfsDB = await EmailUfsModel.bulkCreate(data);

        const emailUfs = emailUfsDB.map(emailUf => emailUf.get({plain: true}));

        console.log('Retorno Email - Operator após manipulação: ', emailUfs);

        return emailUfs;
    }

    async saveEmailAgeRange(campaignId: number, ageRange: number[]): Promise<AgeRange> {
        const emailAgeRangesDB = await AgeRangeModel.create({
            min: ageRange[0],
            max: ageRange[1],
            emailCampaignId: campaignId,
        });

        const emailAgeRange = emailAgeRangesDB.get({plain: true}) as AgeRange;

        console.log('Retorno Email - Operator após manipulação: ', emailAgeRange);

        return emailAgeRange;
    }

    async saveEmailValidity(campaignId: number, validity: string[]): Promise<Validity> {
        const emailValidityDB = await ValidityModel.create({
            start: validity[0],
            end: validity[1],
            emailCampaignId: campaignId,
        });

        const emailValidity = emailValidityDB.get({plain: true}) as Validity;

        console.log('Retorno Email - Operator após manipulação: ', emailValidity);

        return emailValidity;
    }

    /*********************************** DELETE - TABELAS ASSOCIATIVAS DE FILTROS + EMAILCAMPAIGN ***********************************/
    async deleteAllFiltersByCampaignId(emailCampaignId: number): Promise<void> {
        if(!emailCampaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const models = [
            { name: 'Operators', model: EmailOperatorsModel },
            { name: 'Plans', model: EmailPlansModel },
            { name: 'ContractStatus', model: EmailContractStatusModel },
            { name: 'Modality', model: EmailModalityModel },
            { name: 'Ufs', model: EmailUfsModel },
            { name: 'AgeRange', model: AgeRangeModel },
            { name: 'Validity', model: ValidityModel },
        ];
        
        try {
            for (const { model } of models) {
                await model.destroy({ where: { emailCampaignId } });
            }
        } catch (error) {
            throw new Error(`Ocorreu algum erro na exclusão das tabelas associativas: ${error}`)
        }

        console.log('Todos os filtros foram deletados com sucesso');
    }
      
    async deleteEmailOperators(emailCampaignId: number): Promise<any | void> {
        try {
            if(!emailCampaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');
            
            const exist = await EmailOperatorsModel.count({ where: { emailCampaignId } })
            
            if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

            const deleteEmailOperatorsResult = await EmailOperatorsModel.destroy({where: {emailCampaignId}});
    
            if(deleteEmailOperatorsResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
            
            return `operators - Deleção realizada com sucesso. ${deleteEmailOperatorsResult} foram deletadas.`
        } catch (error) {
            console.log('Erro ao deleter emailOperator: ', error);
        }
    }

    async deleteEmailPlans(emailCampaignId: number): Promise<string | void> {
        if(!emailCampaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await EmailPlansModel.count({ where: { emailCampaignId } })
            
        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const deleteEmailPlansResult = await EmailPlansModel.destroy({where: {emailCampaignId}});

        if(deleteEmailPlansResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
        
        return `plans - Deleção realizada com sucesso. ${deleteEmailPlansResult} foram deletadas.`
    }

    async deleteEmailContractStatus(emailCampaignId: number): Promise<string | void> {
        if(!emailCampaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await EmailContractStatusModel.count({ where: { emailCampaignId } })
            
        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const deleteEmailContractStatusesResult = await EmailContractStatusModel.destroy({where: {emailCampaignId}});

        if(deleteEmailContractStatusesResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
        
        return `contractStatus - Deleção realizada com sucesso. ${deleteEmailContractStatusesResult} foram deletadas.`
    }

    async deleteEmailModality(emailCampaignId: number): Promise<string | void> {
        if(!emailCampaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await EmailModalityModel.count({ where: { emailCampaignId } })
            
        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const deleteEmailModalitiesResult = await EmailModalityModel.destroy({where: {emailCampaignId}});

        if(deleteEmailModalitiesResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
        
        return `modality - Deleção realizada com sucesso. ${deleteEmailModalitiesResult} foram deletadas.`
    }

    async deleteEmailUf(emailCampaignId: number): Promise<string | void> {
        if(!emailCampaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await EmailUfsModel.count({ where: { emailCampaignId } })
            
        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const deleteEmailUfsResult = await EmailUfsModel.destroy({where: {emailCampaignId}});

        if(deleteEmailUfsResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
        
        return `uf - Deleção realizada com sucesso. ${deleteEmailUfsResult} linhas foram deletadas.`
    }

    async deleteEmailAgeRange(emailCampaignId: number): Promise<string | void> {
        if(!emailCampaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await AgeRangeModel.count({ where: { emailCampaignId } })
            
        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const deleteEmailAgeRangeResult = await AgeRangeModel.destroy({where: {emailCampaignId}});

        if(deleteEmailAgeRangeResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
        
        return `Deleção realizada com sucesso. ${deleteEmailAgeRangeResult} foram deletadas.`
    }

    async deleteEmailValidity(emailCampaignId: number): Promise<string | void> {
        if(!emailCampaignId) throw new Error('Não foi passado nenhum id para direcionar a deleção');

        const exist = await ValidityModel.count({ where: { emailCampaignId } })
            
        if(exist === 0) return 'Não existe esse dado no DB - pode salvar';

        const deleteEmailValidityResult = await ValidityModel.destroy({where: {emailCampaignId}});

        if(deleteEmailValidityResult <= 0) throw new Error('Erro - Nenhuma linha foi deletada do banco de dados');
        
        return `Deleção realizada com sucesso. ${deleteEmailValidityResult} foram deletadas.`
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
}
