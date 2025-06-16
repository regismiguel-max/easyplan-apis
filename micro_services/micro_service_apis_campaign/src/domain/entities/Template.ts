export default class TemplateEntity {
    public templateName: string;
    public templateContent: string;
    public typeTemplate: string;
    public id?: number;
    constructor(
        templateName: string,
        templateContent: string,
        typeTemplate: string,
        id?: number,
    ) {
        if (id) this.id = id;
        this.templateName = templateName;
        this.templateContent = templateContent;
        this.typeTemplate = typeTemplate;
    }
}