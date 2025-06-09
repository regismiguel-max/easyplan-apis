import path from "path";
import * as fs from 'fs';
import EmailTemplateRepository from "../../../infrastructure/repositories/email-template.repository";
import IEditTemplateUseCase from "../../usecases-interfaces/email-campaign/i-edit-template.usecase";
import EmailTemplateEntity from "../../../domain/entities/EmailTemplate";
import EmailTemplate from "../../../domain/entities/interfaces/email-campaign/email-template.interface";
import EmailTemplateDTO from "../../../presentation/dtos/email-campaign/input/email-template.dto";

export default class EditTemplateUseCase implements IEditTemplateUseCase {
    constructor(private emailTemplateRepository: EmailTemplateRepository) {}

    public async execute(dto: EmailTemplateDTO): Promise<EmailTemplate> {
        if(!dto) throw new Error('Use case não recebeu nenhum DTO para trabalhar');
        if (!dto.templateId) throw new Error('Template ID é obrigatório para edição');
        
        // Buscar o template existente
        const existingTemplate: EmailTemplate = await this.emailTemplateRepository.findById(dto.templateId);
        if (!existingTemplate) throw new Error('Template não encontrado');

        const folderPath: string = path.join(__dirname, '../../../../templateHTML');

        const currentFileName: string = `${existingTemplate.templateName}.html`;
        const currentFilePath: string = path.join(folderPath, currentFileName);

        const newFileName: string = `${dto.templateName}.html`;
        const newFilePath: string = path.join(folderPath, newFileName);

        const isNameChanged: boolean = existingTemplate.templateName !== dto.templateName;

        try {
            if (isNameChanged) {
                // Deletar o arquivo antigo
                if (fs.existsSync(currentFilePath)) {
                    fs.unlinkSync(currentFilePath);
                }
            }

            //  Criar ou sobrescrever o novo arquivo
            fs.writeFileSync(newFilePath, dto.templateHTML);

        } catch (error) {
            throw new Error('Erro ao manipular arquivos no sistema');
        }

        // Pegar o caminho absoluto
        const absolutePath = path.resolve(newFilePath);
                
        // Criar Instância de Email Template com o caminho do arquivo
        const emailTemplate = new EmailTemplateEntity(
            dto.templateName,
            absolutePath,
            dto.templateId
        );
        if(!emailTemplate.id) throw new Error('emailTemplate sem id para ser persistido');
        
        // Enviar para o repository
        const updateResult: string = await this.emailTemplateRepository.update(emailTemplate);
        
        if(updateResult === 'Nenhum registro atualizado') throw new Error('Foi solicitado edição do template, porém nenhum campo foi editado.');
    
        const updatedTemplate: EmailTemplate = await this.emailTemplateRepository.findById(emailTemplate.id);

        const htmlContent = fs.readFileSync(updatedTemplate.absolutePath, 'utf-8');
                    
        updatedTemplate.absolutePath = htmlContent;

        const editTemplateResponse: EmailTemplate = {
            id: updatedTemplate.id,
            templateName: updatedTemplate.templateName,
            absolutePath: updatedTemplate.absolutePath,
            createdAt: updatedTemplate.createdAt,
            updatedAt: updatedTemplate.updatedAt
        }

        return editTemplateResponse;
    }
}