import path from "path";
import * as fs from 'fs';
import EmailTemplateDTO from "../../../presentation/dtos/email-campaign/input/assign-email-template.dto";
import EmailTemplateEntity from "../../../domain/entities/EmailTemplate";
import IEmailCampaignRepository from "../../../domain/contracts/repositories/IEmailCampaignRepository";
import IEmailTemplateRepository from "../../../domain/contracts/repositories/IEmailTemplateRepository";
import IAssignEmailTemplateUseCase from "../../../domain/contracts/usecase/IAssignEmailTemplateUseCase";

export default class AssignEmailTemplateUseCase implements IAssignEmailTemplateUseCase {
    
    constructor(
        private emailCampaignRepository: IEmailCampaignRepository,
        private emailTemplateRepository: IEmailTemplateRepository
    ){}

    public async execute(dto: EmailTemplateDTO): Promise<EmailTemplateEntity> {
        console.log('Entramos  no use case');
        // Pegar o html
        const htmlString: string | undefined = dto.templateHTML;
        // Transformar a string HTML em um arquivo HTML real
        const fileName = `${dto.templateName}.html`;
        // Cria o caminho para o arquivo 
        const filePath = path.join(__dirname, '../../../../templateHTML', fileName);
        // Importa o documento html para a pasta
        if (htmlString) {
            fs.writeFileSync(filePath, htmlString);
        }
        // Pegar o caminho absoluto
        const absolutePath = path.resolve(filePath);
        console.log('Caminho absoluto', absolutePath);
        
        // Criar Instância de Email Template com o caminho do arquivo
        const emailTemplate = new EmailTemplateEntity(
            dto.templateName,
            absolutePath,
        )
        // Enviar para o repository
        console.log('Entidade criada. Chamar o repository');
        const saveResult = await this.emailTemplateRepository.save(emailTemplate);
        console.log('Email Template salvo com sucesso', saveResult);

        // let msgResult: string = '';
        // if (emailTemplateRepositoryResult) {
        //     const emailCampaignDBResult = await this.emailCampaignRepository.findById(dto.campaignId);
        //     console.log('Encontramos a campanha', emailCampaignDBResult);
            
        //     if (!emailTemplateRepositoryResult.id) throw new Error("Error do id do template não existir");
        //     msgResult = await this.emailCampaignRepository.updateEmailTemplateId(emailTemplateRepositoryResult.id, emailCampaignDBResult);
        //     console.log('Campanha atualizada', msgResult);
        // }
        // if (msgResult.includes('Falhou')) throw new Error("Falha na atibuição do template com a campanha");

        return saveResult;
    }
}