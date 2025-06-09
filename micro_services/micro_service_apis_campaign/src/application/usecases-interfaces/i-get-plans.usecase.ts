import Plan from "../../domain/entities/interfaces/filters/plan.interface";

export default interface IGetPlansUseCase {
    execute(): Promise<Plan[]>;
    executeByOperators(codigo_produto: string): Promise<Plan[]>
}