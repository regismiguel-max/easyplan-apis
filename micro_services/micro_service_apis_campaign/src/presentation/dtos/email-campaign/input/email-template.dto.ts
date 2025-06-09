import { IsNotEmpty, IsNumber, IsOptional, IsString, MinLength, ValidateIf } from "class-validator";

class EmailTemplateDTO {
    // @IsNotEmpty({ message: "O ID da campanha é obrigatório" })
    // @IsString()
    // @IsNotEmpty({ message: "O nome de quem criou o template é obrigatório" })
    // public createdBy: string;

    // @IsString()
    // @IsOptional()
    // @MinLength(2)
    // @ValidateIf(o => !o.templateId) // Apenas obrigatório se templateId NÃO estiver presente
    // public htmlData?: string;
    
    @IsString()
    @IsNotEmpty({ message: "O html do template do e-mail é obrigatório" })
    public templateHTML: string;
    
    @IsString()
    @IsNotEmpty({ message: "O nome do template do e-mail é obrigatório" })
    public templateName: string;
    
    @IsNumber()
    @IsOptional()
    // @ValidateIf(o => !o.htmlData) // Apenas obrigatório se htmlContent NÃO estiver presente
    public templateId?: number;
    
    @IsNumber()
    @IsOptional()
    public campaignId?: number;


    constructor(data: EmailTemplateDTO) {        
        this.templateHTML = data.templateHTML;
        this.templateName = data.templateName;

        if(data.templateId) this.templateId = data.templateId;
        if(data.campaignId) this.campaignId = data.campaignId;
        // this.createdBy = data.createdBy ?? "";
    }
}

export default EmailTemplateDTO;