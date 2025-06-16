import path from "path";
import * as fs from 'fs';
import TemplateRepository from "../../infrastructure/repositories/template.repository";
import IEditTemplateUseCase from "../../domain/contracts/usecase/IEditTemplate.usecase";
import TemplateEntity from "../../domain/entities/Template";
import Template from "../../domain/entities/interfaces/template.interface";
import TemplateDTO from "../../presentation/dtos/template.dto";

export default class EditTemplateUseCase implements IEditTemplateUseCase {
    constructor(private templateRepository: TemplateRepository) {}

    public async execute(dto: TemplateDTO): Promise<Template> {
        if(!dto) throw new Error('Use case não recebeu nenhum DTO para trabalhar');
        if (!dto.templateId) throw new Error('Template ID é obrigatório para edição');
        
        // Buscar o template existente
        const existingTemplate: Template = await this.templateRepository.findById(dto.templateId);
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
            fs.writeFileSync(newFilePath, dto.templateContent);

        } catch (error) {
            throw new Error('Erro ao manipular arquivos no sistema');
        }

        // Pegar o caminho absoluto
        const absolutePath = path.resolve(newFilePath);
                
        // Criar Instância de Email Template com o caminho do arquivo
        const emailTemplate = new TemplateEntity(
            dto.templateName,
            absolutePath,
            'email',
            dto.templateId
        );
        if(!emailTemplate.id) throw new Error('emailTemplate sem id para ser persistido');
        
        // Enviar para o repository
        const updateResult: string = await this.templateRepository.update(emailTemplate);
        
        if(updateResult === 'Nenhum registro atualizado') throw new Error('Foi solicitado edição do template, porém nenhum campo foi editado.');
    
        const updatedTemplate: Template = await this.templateRepository.findById(emailTemplate.id);

        const htmlContent = fs.readFileSync(updatedTemplate.templateContent, 'utf-8');
                    
        updatedTemplate.templateContent = htmlContent;

        const editTemplateResponse: Template = {
            id: updatedTemplate.id,
            templateName: updatedTemplate.templateName,
            templateContent: updatedTemplate.templateContent,
            typeTemplate: updatedTemplate.typeTemplate,
            createdAt: updatedTemplate.createdAt,
            updatedAt: updatedTemplate.updatedAt
        }

        return editTemplateResponse;
    }
}