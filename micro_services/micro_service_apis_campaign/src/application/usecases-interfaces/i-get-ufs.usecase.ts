import Uf from "../../domain/entities/interfaces/filters/uf.interface";

export default interface IGetUfsUseCase {
    execute(): Promise<Uf[]>;
}