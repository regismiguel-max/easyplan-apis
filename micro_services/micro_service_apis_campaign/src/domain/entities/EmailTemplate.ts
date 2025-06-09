export default class EmailTemplateEntity {
    public templateName: string;
    public absolutePath: string;
    public id?: number;
    constructor(
        templateName: string,
        absolutePath: string,
        id?: number,
    ) {
        if (id) this.id = id;
        this.templateName = templateName;
        this.absolutePath = absolutePath;
    }
}