import { where } from "sequelize";
import IEmailTemplateRepository from "../../domain/contracts/repositories/IEmailTemplateRepository";
import EmailTemplateEntity from "../../domain/entities/EmailTemplate";
import EmailTemplateModel from "../database/models/email-template.model";
import EmailTemplate from "../../domain/entities/interfaces/email-campaign/email-template.interface";

export default class EmailTemplateRepository implements IEmailTemplateRepository {
    public async save(emailTemplate: EmailTemplateEntity): Promise<EmailTemplate> {
        // salvar no db transformando a entidade em model
        const assignTemplateDBResult = await EmailTemplateModel.create({
            templateName: emailTemplate.templateName,
            absolutePath: emailTemplate.absolutePath,
        });

        // transformar em um objeto puro
        const pureObject = assignTemplateDBResult.get({plain: true}) as EmailTemplate;

        // transformar model em entidade novamente
        return pureObject;
    }

    public async findById(id: number): Promise<EmailTemplate> {
        const result = await EmailTemplateModel.findByPk(id);
        
        const pureObject = result?.get({plain: true}) as EmailTemplate;

        return pureObject;
    }

    public async update(emailTemplate: EmailTemplateEntity): Promise<string> {
        if(!emailTemplate) throw new Error('Repository não recebeu o Template para poder persistir');

        const registerUpdated = await EmailTemplateModel.update(
            emailTemplate,
            {where: {id: emailTemplate.id}}
        );

        if(!registerUpdated) throw new Error('Ocorreu algum erro na atualização do template. Nenhum registro foi atualizado');

        return registerUpdated.length > 0 ? 'Atualização ocorrida com sucesso' : 'Nenhum registro atualizado';

    }
}