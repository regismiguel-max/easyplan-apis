import { validate, ValidationError } from "class-validator";
import { NextFunction, Request, Response } from "express";
import EmailTemplateDTO from "../dtos/email-campaign/input/email-template.dto";
import ISaveEmailCampaignUseCase from "../../domain/contracts/usecase/ISaveEmailCampaignUseCase.interface";
import ISaveEmailTemplateUseCase from "../../domain/contracts/usecase/ISaveEmailTemplateUseCase";
import IGetAllEmailCampaignsUseCase from "../../domain/contracts/usecase/IGetAllEmailCampaignsUseCase";
import IGetEmailCampaignUseCase from "../../domain/contracts/usecase/IGetEmailCampaigUseCase";
import CRUDEmailCampaignDTO from "../dtos/email-campaign/input/crud-email-campaign.dto";
import IDeleteEmailCampaignUseCase from "../../domain/contracts/usecase/IDeleteEmailCampaignUseCase";
import IEditEmailCampaingUseCase from "../../domain/contracts/usecase/IEditEmailCampaignUseCase";
import EmailCampaignRepository from "../../infrastructure/repositories/email-campaign.repository";
import EmailTemplateRepository from "../../infrastructure/repositories/email-template.repository";
import EditTemplateUseCase from "../../application/usecases/email-campaign/template-edit.usecase";
import SaveResponse from "../../domain/entities/interfaces/email-campaign/output/save-response.interface";
import EditResponse from "../../domain/entities/interfaces/email-campaign/output/edit-response.interface";
import EmailCampaign from "../../domain/entities/interfaces/email-campaign/email-campaign.interface";
import { ShortFullEmailCampaign } from "../../domain/entities/interfaces/email-campaign/full-email-campaign.interface";
import EmailTemplate from "../../domain/entities/interfaces/email-campaign/email-template.interface";


class EmailCampaignController {

    constructor(
        private saveEmailCampaignUseCase?: ISaveEmailCampaignUseCase,
        private saveEmailTemplateUseCase?: ISaveEmailTemplateUseCase,
        private getAllEmailCampaignsUseCase?: IGetAllEmailCampaignsUseCase,
        private getEmailCampaignUseCase?: IGetEmailCampaignUseCase,
        private editEmailCampaign?: IEditEmailCampaingUseCase,
        private deleteEmailCampaign?: IDeleteEmailCampaignUseCase,
        private emailCampaignRepository?: EmailCampaignRepository,
        private editTemplateUseCase?: EditTemplateUseCase
    ) {}

    public async save(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Converte a requisição para o DTO desse caso de uso
            const dto = await new CRUDEmailCampaignDTO(req.body);
            console.log(dto)

            // Validar os dados
            // const error = await this.validateDTO(dto);

            // if (error)  {
            //     console.log('Deu erro sim', error);
            //     res.status(403).json({
            //         status: 403,
            //         success: false,
            //         message: 'Dados inválidos',
            //         data: error,
            //         dto: dto
            //     })
            //     return;
            // };



            const saved: SaveResponse | undefined = await this.saveEmailCampaignUseCase?.execute(dto);

            if (!saved) {
                res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Erro ao salvar campanha',
                    data: saved
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
            
            const dto = new CRUDEmailCampaignDTO(data);

            // const error = await this.validateDTO(dto);
            // if (error) {
            //     res.status(403).json({
            //         success: false,
            //         message: 'Dados Inválidos',
            //         data: error
            //     });

            //     return;
            // }

            const result: EditResponse | undefined = await this.editEmailCampaign?.execute(dto);

            if (!result) {
                res.status(500).json({ 
                    success: false,
                    message: result,
                });
                return
            };
            
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
    
            const result: string | undefined = await this.deleteEmailCampaign?.execute(id);

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
            // Chamar o UseCase
            const result: EmailCampaign[] | undefined = await this.getAllEmailCampaignsUseCase?.execute();
            // Validar retorno
            if (!result) {
                res.status(404).json({ 
                    success: false,
                    message: 'Nenhuma campanha encontrada',
                    data: result
                });
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
            const result: ShortFullEmailCampaign | undefined = await this.getEmailCampaignUseCase?.execute(id);
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
            const dto = new EmailTemplateDTO(req.body);
    
            // Validação dos dados de entrada
            // const error = await this.validateDTO(dto);

            // if (error) {
            //     res.status(403).json({
            //         success: false,
            //         message: 'Dados Inválidos',
            //         data: error
            //     })
            //     return;
            // };
                
            const result: EmailTemplate | undefined = await this.saveEmailTemplateUseCase?.execute(dto);

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
    
            const dtoTemplateToEdit = new EmailTemplateDTO(templateToEdit);
    
            const error = await this.validateDTO(dtoTemplateToEdit);
            if (error) {
                res.status(403).json({
                    success: false,
                    message: 'Dados Inválidos',
                    data: error
                })
                return;
            }
    
            const result: EmailTemplate | undefined = await this.editTemplateUseCase?.execute(dtoTemplateToEdit);

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

    private async validateDTO<T extends object>(dto: T): Promise<ValidationError[] | void> {
        const errors = await validate(dto);
        if (errors.length > 0) {
            return errors;
        }
    }
}

export default EmailCampaignController;