import { Model } from "sequelize";

export default interface IGetModalitiesUseCase {
    execute(): Promise<Model<any, any>[]>;
}