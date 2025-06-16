import ITemplateRepository from "../../domain/contracts/repositories/ITemplateRepository";
import TemplateEntity from "../../domain/entities/Template";
import CampaignTemplateModel from "../database/models/template.model";
import Template from "../../domain/entities/interfaces/template.interface";

export default class TemplateRepository implements ITemplateRepository {
    public async save(template: TemplateEntity): Promise<Template> {
        // salvar no db transformando a entidade em model
        const assignTemplateDBResult = await CampaignTemplateModel.create({
            templateName: template.templateName,
            templateContent: template.templateContent,
            typeTemplate: template.typeTemplate
        });

        // transformar em um objeto puro
        const pureObject = assignTemplateDBResult.get({plain: true}) as Template;

        // transformar model em entidade novamente
        return pureObject;
    }

    public async findById(id: number): Promise<Template> {
        const result = await CampaignTemplateModel.findByPk(id);
        
        const pureObject = result?.get({plain: true}) as Template;

        return pureObject;
    }

    public async update(template: TemplateEntity): Promise<string> {
        if(!template) throw new Error('Repository não recebeu o Template para poder persistir');

        const registerUpdated = await CampaignTemplateModel.update(
            template,
            {where: {id: template.id}}
        );

        if(!registerUpdated) throw new Error('Ocorreu algum erro na atualização do template. Nenhum registro foi atualizado');

        return registerUpdated.length > 0 ? 'Atualização ocorrida com sucesso' : 'Nenhum registro atualizado';

    }
}