import path from "path";
import * as fs from 'fs';
import TemplateDTO from "../../presentation/dtos/template.dto";
import TemplateEntity from "../../domain/entities/Template";
import ICampaignRepository from "../../domain/contracts/repositories/ICampaignRepository";
import ITemplateRepository from "../../domain/contracts/repositories/ITemplateRepository";
import ISaveTemplateUseCase from "../../domain/contracts/usecase/ISaveTemplateUseCase";
import Template from "../../domain/entities/interfaces/template.interface";

export default class SaveTemplateUseCase implements ISaveTemplateUseCase {
    
    constructor(
        private emailCampaignRepository: ICampaignRepository,
        private templateRepository: ITemplateRepository
    ){}

    public async execute(dto: TemplateDTO): Promise<Template> {
        // Pegar o html
        const htmlString: string = dto.templateContent;

        // Transformar a string HTML em um arquivo HTML real
        const fileName: string = `${dto.templateName}.html`;

        // Cria o caminho para o arquivo 
        const filePath: string = path.join(__dirname, '../../../templateHTML', fileName);

        console.log(htmlString);
        console.log(fileName);
        console.log(filePath);
        
        // Importa o documento html para a pasta
        try {
            fs.writeFileSync(filePath, htmlString);
        } catch (error) {
            console.log(error);
            
            throw new Error('Erro ao armazenar o arquivo HTML no projeto');
        }

        // Pegar o caminho absoluto
        // const absolutePath = path.resolve(filePath);
        
        // Criar Instância de Email Template com o caminho do arquivo
        const emailTemplate = new TemplateEntity(
            dto.templateName,
            fileName,
            dto.typeTemplate
        );

        // Enviar para o repository
        const saveResult: Template = await this.templateRepository.save(emailTemplate);

        return saveResult;
    }
}