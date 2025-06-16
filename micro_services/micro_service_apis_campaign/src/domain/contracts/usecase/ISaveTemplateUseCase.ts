import TemplateDTO from "../../../presentation/dtos/template.dto";
import Template from "../../entities/interfaces/template.interface";

export default interface ISaveTemplateUseCase {
    execute(dto: TemplateDTO): Promise<Template>;
}