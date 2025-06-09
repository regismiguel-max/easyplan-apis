import EmailTemplate from "../../../domain/entities/interfaces/email-campaign/email-template.interface";
import EmailTemplateDTO from "../../../presentation/dtos/email-campaign/input/email-template.dto";

export default interface IEditTemplateUseCase {
    execute(dto: EmailTemplateDTO): Promise<EmailTemplate>;
}