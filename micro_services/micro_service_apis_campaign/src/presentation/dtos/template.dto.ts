import { IsNotEmpty, IsNumber, IsOptional, IsString, MinLength, ValidateIf } from "class-validator";

class TemplateDTO {
    @IsString()
    @IsNotEmpty({ message: "O html do template do e-mail é obrigatório" })
    public templateContent: string;
    
    @IsString()
    @IsNotEmpty({ message: "O nome do template do e-mail é obrigatório" })
    public templateName: string;
    
    @IsString()
    @IsNotEmpty({ message: "O nome do template do e-mail é obrigatório" })
    public typeTemplate: string;
    
    @IsString()
    @IsOptional()
    public image?: string;

    @IsNumber()
    @IsOptional()
    public id?: number;
    
    @IsNumber()
    @IsOptional()
    public campaignId?: number;


    constructor(data: TemplateDTO) {        
        this.templateContent = data.templateContent;
        this.templateName = data.templateName;
        this.typeTemplate = data.typeTemplate;

        if(data.id) this.id = data.id;
        if(data.image) this.image = data.image;
        if(data.campaignId) this.campaignId = data.campaignId;
        // this.createdBy = data.createdBy ?? "";
    }
}

export default TemplateDTO;