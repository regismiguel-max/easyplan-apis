import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

export const sequelize = new Sequelize(process.env.AUTOMATION_MYSQL_DATABASE!, process.env.AUTOMATION_MYSQL_USER!, process.env.AUTOMATION_MYSQL_PASSWORD!, {
  host: process.env.AUTOMATION_MYSQL_HOST,
  dialect: "mysql",
  timezone: '-03:00',
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  logging: console.log,
});