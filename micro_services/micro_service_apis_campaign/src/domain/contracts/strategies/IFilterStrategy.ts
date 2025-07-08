import { WhereOptions } from "sequelize";
import BirthDTOPersistence from "../../entities/interfaces/birth-dto-persistence.interface";

export default interface IFilterStrategy {
  save(campaignId: number, ids: number[] | string[] | BirthDTOPersistence | string): Promise<any>;
  delete(camapignId: number): Promise<any>;
  buildWhereClause(ids?: number[] | number | string[] | [number, number] | string | [string, string]): Promise<WhereOptions>;
}