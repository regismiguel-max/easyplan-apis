import EmailTemplateDTO from "../../../presentation/dtos/email-campaign/input/email-template.dto";
import EmailTemplateEntity from "../../entities/EmailTemplate";
import EmailTemplate from "../../entities/interfaces/email-campaign/email-template.interface";

export default interface ISaveEmailTemplateUseCase {
    execute(dto: EmailTemplateDTO): Promise<EmailTemplate>;
}