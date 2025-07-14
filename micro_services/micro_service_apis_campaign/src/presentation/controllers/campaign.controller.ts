import { validate, ValidationError } from "class-validator";
import { NextFunction, Request, Response } from "express";
import TemplateDTO from "../dtos/template.dto";
import ISaveCampaignUseCase from "../../domain/contracts/usecase/ISaveCampaignUseCase.interface";
import ISaveTemplateUseCase from "../../domain/contracts/usecase/ISaveTemplateUseCase";
import IGetAllCampaignsUseCase from "../../domain/contracts/usecase/IGetAllCampaignsUseCase";
import CRUDCampaignDTO from "../dtos/crud-campaign.dto";
import CampaignRepository from "../../infrastructure/repositories/campaign.repository";
import EditTemplateUseCase from "../../application/usecases/edit-template.usecase";
// import SaveResponse from "../../domain/entities/interfaces/email-campaign/output/save-response.interface";
import EditResponse from "../../domain/entities/interfaces/email-campaign/output/edit-response.interface";
import Campaign from "../../domain/entities/interfaces/campaign.interface";
import ShortFullEmailCampaign from "../../domain/entities/interfaces/email-campaign/full-email-campaign.interface";
import Template from "../../domain/entities/interfaces/template.interface";
import IEditCampaingUseCase from "../../domain/contracts/usecase/IEditEmailCampaignUseCase";
import IDeleteCampaignUseCase from "../../domain/contracts/usecase/IDeleteCampaignUseCase";
import IGetCampaignUseCase from "../../domain/contracts/usecase/IGetCampaigUseCase";
import TemplateRepository from "../../infrastructure/repositories/template.repository";

//Get Templates
import path from "path";
import * as fs from 'fs';
import { NotRecipient } from "../../domain/entities/interfaces/not-recipient.interface";


class CampaignController {

    constructor(
        private saveCampaignUseCase?: ISaveCampaignUseCase,
        private saveTemplateUseCase?: ISaveTemplateUseCase,
        private getAllCampaignsUseCase?: IGetAllCampaignsUseCase,
        private getCampaignUseCase?: IGetCampaignUseCase,
        private editCampaign?: IEditCampaingUseCase,
        private deleteCampaign?: IDeleteCampaignUseCase,
        private campaignRepository?: CampaignRepository,
        private editTemplateUseCase?: EditTemplateUseCase,
        private templateRepository?: TemplateRepository
    ) {}

    public async save(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Converte a requisição para o DTO desse caso de uso
            const dto = new CRUDCampaignDTO(req.body);

            // Validar os dados
            // acho que o erro do validate em produção é por conta da tipagem genérica que passamos na função helper validate(dto: T);
            const errors = await validate(dto);

            if (errors.length > 0) {
                console.log('Deu erro sim', errors);
                res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'Dados inválidos',
                    data: errors
                })
                return;
            }

            const saved: Campaign | NotRecipient | undefined = await this.saveCampaignUseCase?.execute(dto);
            console.log('PRG: ', saved);
            

            if (!saved) {
                res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Erro ao salvar campanha',
                    data: saved
                });
                return;
            }

            if(typeof saved === 'object' && 'message' in saved) {
                res.status(404).json({
                    status: 404,
                    success: false,
                    message: saved.message,
                });
    
                return;
            }

            res.status(201).json({
                status: 201,
                success: true,
                message: 'Campanha salva com sucesso!',
                data: saved
            });

            return;
            
        } catch (error) {
            console.error("Erro ao salvar campanha de e-mail:", error);
        
            res.status(500).json({
                status: 500,
                success: false,
                message: "Erro interno no servidor ao salvar campanha",
                error: error instanceof Error ? error.message : error
            });
            return;
        }
    }

    public async edit(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const data = req.body;
            
            const dto = new CRUDCampaignDTO(data);

            // Validar os dados
            const errors = await validate(dto);

            if (errors.length > 0) {
                console.log('Deu erro sim', errors);
                res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'Dados inválidos',
                    data: errors
                })
                return;
            }

            const result: EditResponse | undefined | NotRecipient = await this.editCampaign?.execute(dto);

            if (!result) {
                res.status(500).json({ 
                    success: false,
                    message: result,
                });
                return
            };

            if(typeof result === 'object' && 'message' in result) {
                res.status(404).json({
                    status: 404,
                    success: false,
                    message: result.message,
                });
    
                return;
            }
            
            res.status(201).json({ 
                success: true,
                message: result,
            });

            return
        } catch (error) {
            console.log('Error aqui: ', error);
            
            res.status(500).json({ 
                success: false,
                message: 'Error. Houve algum erro durante o processo de edição',
                data: error
            });
            return
        }
    }

    public async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const id = Number(req.query.id);
            const typeCampaign = req.query.typeCampaign as string;
    
            const result: string | undefined = await this.deleteCampaign?.execute(id, typeCampaign);

            if (!result || result === 'Falha na deleção') {
                res.status(500).json({
                    success: false, 
                    message: 'Erro. Falha na exclusão do item! O banco de dados retornou Null ou Undefinied',
                    data: result
                });
                return
            } 
    
            res.status(201).json({
                success: true,
                message: result,
            });

            return;

        } catch (error) {
            console.log(error);
            
            res.status(500).json({
                success: false, 
                message: 'Erro. Falha na exclusão do item!',
                data: error
            })

            return;
        }
    }

    public async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const typeCampaign: string = typeof req.query.typeCampaign === 'string' ? req.query.typeCampaign : '';
            if(typeCampaign.length <= 0) throw new Error('Não veio o tipo da campanha!');

            // Chamar o UseCase
            const result: Campaign[] | undefined = await this.getAllCampaignsUseCase?.execute(typeCampaign);
            // Validar retorno
            if (!result) {
                res.status(404).json({ 
                    success: false,
                    message: 'Nenhuma campanha encontrada',
                    data: result
                });
                return
            }
            // Retornar para o Front-end a lista de Campanhas de E-mail
            res.status(200).json({ 
                success: true,
                message: 'Lista de campanhas recuperada com sucesso!',
                data: result
            });
            return            
        } catch (error) {
            console.error("Erro ao buscar campanhas:", error);
        
            res.status(500).json({
                status: 500,
                message: "Erro interno no servidor",
                error: error instanceof Error ? error.message : error
            });
            return
        }
    }
    public async getAllTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // const result: Campaign[] | undefined = await this.getAllTemplateUseCase?.execute(typeCampaign);

            const templates = await this.templateRepository?.findAllTemplates();
            console.log('Retorno de todos os templates: ', templates);
            
            // Validar retorno
            if (!templates) {
                res.status(404).json({ 
                    success: false,
                    message: 'Nenhum template encontrado',
                    data: templates
                });
                return
            }

            for(let template of templates) {
                const absolutePathTemplateHTML = path.resolve(__dirname, '../../../templateHTML');
                console.log('absolutePathTemplateHTML local: ', absolutePathTemplateHTML);
                            
                const absolutePath = path.join(absolutePathTemplateHTML, template.templateContent);
                
                console.log('absolutePath local: ', absolutePath);
                
                const htmlContent = fs.readFileSync(absolutePath, 'utf-8');
                            
                console.log('html lido: ', htmlContent);
                            
                template.templateContent = htmlContent;
            }

            // Retornar para o Front-end a lista de Campanhas de E-mail
            res.status(200).json({ 
                success: true,
                message: 'Lista de templates recuperada com sucesso!',
                data: templates
            });
            return            
        } catch (error) {
            console.error("Erro ao buscar campanhas:", error);
        
            res.status(500).json({
                status: 500,
                message: "Erro interno no servidor",
                error: error instanceof Error ? error.message : error
            });
            return
        }
    }

    public async getEmailCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Pegar id da requisição
            const id = Number(req.params.id);

            if (!id || isNaN(id)) {
                res.status(400).json({ 
                    success: false,
                    message: 'ID inválido'
                });
                return
            }

            // Chamar o UseCase
            const result: ShortFullEmailCampaign | undefined = await this.getCampaignUseCase?.execute(id);
            // Validar retorno
            if (!result) {
                res.status(404).json({ 
                    success: false, 
                    message: 'Campanha não encontrada',
                    data: result
                });
            }

            console.log('Só para entender: ', result);
            
            // Retornar para o Front-end a lista de Campanhas de E-mail
            res.status(200).json({ 
                success: true,
                message: 'Campanha encontrada com sucesso!',
                data: result
            });
            return      
        } catch (error) {
            console.error("Erro ao buscar campanha:", error);
        
            res.status(500).json({
                success: false,
                message: "Erro interno no servidor",
                error: error instanceof Error ? error.message : error
            });
            return
        }
    }

    public async saveTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const dto = new TemplateDTO(req.body);
    
            // Validar os dados
            const errors = await validate(dto);

            if (errors.length > 0) {
                console.log('Deu erro sim', errors);
                res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'Dados inválidos',
                    data: errors
                })
                return;
            }
                
            const result: Template | undefined = await this.saveTemplateUseCase?.execute(dto);

            if (!result) {
                res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Falha ao salvar o template',
                });
                return;
            }
                    
            res.status(201).json({ 
                success: true,
                message: 'Template salvo e atribuído com sucesso!',
                data: result
            });
            return;

        } catch (error) {
            console.error("Erro ao salvar template e ou atribuir:", error);
        
            res.status(500).json({
                success: false,
                message: "Erro interno no servidor",
                error: error instanceof Error ? error.message : error
            });
            return
        }
    }

    public async editTemplate(req: Request, res: Response): Promise<void> {
        try {
            const templateToEdit = req.body;
    
            const dtoTemplateToEdit = new TemplateDTO(templateToEdit);
    
            // Validar os dados
            const errors = await validate(dtoTemplateToEdit);

            if (errors.length > 0) {
                console.log('Deu erro sim', errors);
                res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'Dados inválidos',
                    data: errors
                })
                return;
            }
    
            const result: Template | undefined = await this.editTemplateUseCase?.execute(dtoTemplateToEdit);

            if (!result) {
                res.status(500).json({ 
                    success: false,
                    message: result,
                });
                return
            }
            
            console.log('Resultado final recebido: ', result);
            
            res.status(201).json({
                staus: 201,
                success: true,
                message: 'Template editado com sucesso',
                data: result
            });
            return
        } catch (error) {
            console.error("Erro ao salvar template:", error);
        
            res.status(500).json({
                success: false,
                message: "Erro interno no servidor",
                error: error instanceof Error ? error.message : error
            });
            return
        }
    }
}

export default CampaignController;