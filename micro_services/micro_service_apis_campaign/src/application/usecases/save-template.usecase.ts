import path from "path";
import * as fs from 'fs';
import TemplateDTO from "../../presentation/dtos/template.dto";
import TemplateEntity from "../../domain/entities/Template";
import ICampaignRepository from "../../domain/contracts/repositories/ICampaignRepository";
import ITemplateRepository from "../../domain/contracts/repositories/ITemplateRepository";
import ISaveTemplateUseCase from "../../domain/contracts/usecase/ISaveTemplateUseCase";
import Template from "../../domain/entities/interfaces/template.interface";
import KaulizHelper from "../../infrastructure/queue/workers/kauliz-status.helper";

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
        const emailTemplate = new TemplateEntity(
            dto.templateName,
            fileName,
            dto.typeTemplate
        );
        
        if(dto.image){
            // const mimeType = .match(/^data:(.*);base64,/)?.toString();
            const mimeMatch = dto.image?.match(/^data:(.+);base64,/);

            const mimeType = mimeMatch ? mimeMatch[1] : null;

            if(mimeType){
                console.log('Olhaaaaaa', mimeType);
                
                const fileId = await KaulizHelper.uploadImage(dto.image, dto.templateName, mimeType);
                emailTemplate.addImageId(fileId);
            }
        }    
        
        // Criar Instância de Email Template com o caminho do arquivo

        // Enviar para o repository
        const saveResult: Template = await this.templateRepository.save(emailTemplate);

        return saveResult;
    }
}