export default interface Template {
    id: number;
    templateName: string;
    templateContent: string;
    typeTemplate: string;
    imageId: string | null;
    createdAt: Date;
    updatedAt: Date;
}