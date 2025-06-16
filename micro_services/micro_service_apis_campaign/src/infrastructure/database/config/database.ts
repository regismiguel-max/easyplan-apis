import * as dotenv from "dotenv";
dotenv.config();

import { Sequelize } from "sequelize";

const connection_db = new Sequelize(
    process.env.CAMPAIGN_MYSQL_DATABASE as string,
    process.env.CAMPAIGN_MYSQL_USER as string,
    process.env.CAMPAIGN_MYSQL_PASSWORD as string,
    {
        host: process.env.CAMPAIGN_MYSQL_HOST,
        port: Number(process.env.CAMPAIGN_MYSQL_PORT),
        dialect: 'mysql',
        timezone: '-03:00'
    }
);

export default connection_db;