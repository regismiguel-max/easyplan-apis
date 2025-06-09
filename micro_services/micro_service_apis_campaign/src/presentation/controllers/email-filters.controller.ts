import { Request, Response } from "express"
import IGetOperatorsUseCase from "../../application/usecases-interfaces/i-get-operators.usecase";
import IGetPlansUseCase from "../../application/usecases-interfaces/i-get-plans.usecase";
import IGetContractStatusesUseCase from "../../application/usecases-interfaces/i-get-contract-statuses.usecase";
import IGetModalitiesUseCase from "../../application/usecases-interfaces/i-get-modalities.usecase";
import IGetUfsUseCase from "../../application/usecases-interfaces/i-get-ufs.usecase";
import Operator from "../../domain/entities/interfaces/filters/operator.interface";
import Plan from "../../domain/entities/interfaces/filters/plan.interface";
import ContractStatus from "../../domain/entities/interfaces/filters/contract-status.interface";
import Uf from "../../domain/entities/interfaces/filters/uf.interface";

export default class EmailFiltersController {
    
    
    constructor(
        private getOperatorsUseCase?: IGetOperatorsUseCase,
        private getPlansUseCase?: IGetPlansUseCase,
        private getContractStatusesUseCase?: IGetContractStatusesUseCase,
        private getModalitiesUseCase?: IGetModalitiesUseCase,
        private getUfsUseCase?: IGetUfsUseCase,
    ) {}
    
    public async getOperators(req: Request, res: Response) {
        try {
            const operators = await this.getOperatorsUseCase?.execute();
               
            res.status(200).json({
                status: 200,
                success: true,
                message: 'Deu tudo certo para pegar as operadoras',
                data: operators
            })

            return;
        } catch (error) {
            console.log('Caiu no erro de algum lugar: ', error);
            
            res.status(500).json({
                status: 500,
                success: false,
                data: error
            })

            return;
        }
    }

    public async getPlansByOperator(req: Request, res: Response) {
        if(!this.getOperatorsUseCase) throw new Error('O caso de uso para essa requisição não foi injetado corretamente');
        if(!this.getPlansUseCase) throw new Error('O caso de uso para essa requisição não foi injetado corretamente');
        
        try {
            const id = Number(req.params.operator);

            const operator: Operator = await this.getOperatorsUseCase.executeById(id);

            const codigo_produto = operator.codigo_produto;

            const plansByOperators: Plan[] = await this.getPlansUseCase.executeByOperators(codigo_produto);

            res.status(200).json({
                status: 200,
                success: true,
                message: 'Deu tudo certo para pegar os planos da operadora',
                data: plansByOperators
            })
            
            return;
        } catch (error) {
            console.log('Error: ', error);
            
            res.status(500).json({
                status: 500,
                success: false,
                data: error
            })

            return;
        }
    }
    public async getPlans(req: Request, res: Response) {
        if(!this.getPlansUseCase) throw new Error('O caso de uso para essa requisição não foi injetado corretamente');
        
        try {
            const plans: Plan[] = await this.getPlansUseCase.execute();

            res.status(200).json({
                status: 200,
                success: true,
                message: 'Deu tudo certo para pegar os planos da operadora',
                data: plans
            })
            
            return;
        } catch (error) {
            console.log('Error - GetPlans: ', error);
            
            res.status(500).json({
                status: 500,
                success: false,
                data: error
            })

            return;
        }
    }

    public async getContractStatuses(req: Request, res: Response) {
        if(!this.getContractStatusesUseCase) throw new Error('O caso de uso para essa requisição não foi injetado corretamente');

        try {
            const contractStatuses: ContractStatus[] = await this.getContractStatusesUseCase.execute();

            res.status(200).json({
                status: 200,
                success: true,
                message: 'Deu tudo certo para pegar as operadoras',
                data: contractStatuses
            })

            return;
        } catch (error) {
            res.status(500).json({
                status: 500,
                success: false,
                data: error
            })

            return;
        }
    }

    public async getModalities(req: Request, res: Response) {
        try {
            console.log('Modalities - Entrei na controller');

            const modalities = await this.getModalitiesUseCase?.execute();
            
            // console.log('Modalities - resultado do use case: ', modalities);
            console.log('Modalities - resultado do use case: ');

            res.status(200).json({
                status: 200,
                success: true,
                message: 'Deu tudo certo para pegar as operadoras',
                data: modalities
            })

            return;
        } catch (error) {
            res.status(500).json({
                status: 500,
                success: false,
                data: error
            })

            return;
        }
    }

    public async getUfs(req: Request, res: Response) {
        if(!this.getUfsUseCase) throw new Error('O caso de uso para essa requisição não foi injetado corretamente');

        try {
            console.log('Ufs - Entrei na controller');

            const ufs: Uf[] = await this.getUfsUseCase.execute();
               
            res.status(200).json({
                status: 200,
                success: true,
                message: 'Deu tudo certo para pegar as operadoras',
                data: ufs
            })

            return;
        } catch (error) {
            res.status(500).json({
                status: 500,
                success: false,
                data: error
            })

            return;
        }
    }
}