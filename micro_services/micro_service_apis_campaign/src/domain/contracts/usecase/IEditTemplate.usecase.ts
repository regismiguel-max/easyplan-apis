import Template from "../../entities/interfaces/template.interface";
import TemplateDTO from "../../../presentation/dtos/template.dto";

export default interface IEditTemplateUseCase {
    execute(dto: TemplateDTO): Promise<Template>;
}