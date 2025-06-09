import path from "path";
import * as fs from 'fs';
import EmailTemplateDTO from "../../../presentation/dtos/email-campaign/input/email-template.dto";
import EmailTemplateEntity from "../../../domain/entities/EmailTemplate";
import IEmailCampaignRepository from "../../../domain/contracts/repositories/IEmailCampaignRepository";
import IEmailTemplateRepository from "../../../domain/contracts/repositories/IEmailTemplateRepository";
import ISaveEmailTemplateUseCase from "../../../domain/contracts/usecase/ISaveEmailTemplateUseCase";
import EmailTemplate from "../../../domain/entities/interfaces/email-campaign/email-template.interface";

export default class SaveEmailTemplateUseCase implements ISaveEmailTemplateUseCase {
    
    constructor(
        private emailCampaignRepository: IEmailCampaignRepository,
        private emailTemplateRepository: IEmailTemplateRepository
    ){}

    public async execute(dto: EmailTemplateDTO): Promise<EmailTemplate> {
        // Pegar o html
        const htmlString: string = dto.templateHTML;

        // Transformar a string HTML em um arquivo HTML real
        const fileName: string = `${dto.templateName}.html`;

        // Cria o caminho para o arquivo 
        const filePath: string = path.join(__dirname, '../../../../templateHTML', fileName);

        // Importa o documento html para a pasta
        try {
            fs.writeFileSync(filePath, htmlString);
        } catch (error) {
            throw new Error('Erro ao armazenar o arquivo HTML no projeto');
        }

        // Pegar o caminho absoluto
        const absolutePath = path.resolve(filePath);
        
        // Criar Instância de Email Template com o caminho do arquivo
        const emailTemplate = new EmailTemplateEntity(
            dto.templateName,
            absolutePath,
        );

        // Enviar para o repository
        const saveResult: EmailTemplate = await this.emailTemplateRepository.save(emailTemplate);

        return saveResult;
    }
}