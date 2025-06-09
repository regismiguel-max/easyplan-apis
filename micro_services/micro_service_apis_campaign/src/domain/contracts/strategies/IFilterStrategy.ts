import { WhereOptions } from "sequelize";

export default interface IFilterStrategy {
  save(campaignId: number, ids: number[] | string[]): Promise<any>;
  delete(camapignId: number): Promise<any>;
  buildWhereClause(ids?: number[] | number | string[]): Promise<WhereOptions>;
}