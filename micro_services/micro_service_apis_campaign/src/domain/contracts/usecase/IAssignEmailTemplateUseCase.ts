import AssignEmailTemplateDTO from "../../../presentation/dtos/email-campaign/input/assign-email-template.dto";
import EmailTemplateEntity from "../../entities/EmailTemplate";
export default interface IAssignEmailTemplateUseCase {
    execute(dto: AssignEmailTemplateDTO): Promise<EmailTemplateEntity>;
}