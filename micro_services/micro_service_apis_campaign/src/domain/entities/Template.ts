export default class TemplateEntity {
    public templateName: string;
    public templateContent: string;
    public typeTemplate: string;
    public imageId?: number;
    public id?: number;
    constructor(
        templateName: string,
        templateContent: string,
        typeTemplate: string,
        imageId?: number,
        id?: number,
    ) {
        if (imageId) this.imageId = imageId;
        if (id) this.id = id;
        this.templateName = templateName;
        this.templateContent = templateContent;
        this.typeTemplate = typeTemplate;
    }

    addImageId(imageId: number) {
        this.imageId = imageId;
    }
}