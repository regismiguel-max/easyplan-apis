const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  production: {
    username: process.env.CAMPAIGN_MYSQL_USER,
    password: process.env.CAMPAIGN_MYSQL_PASSWORD,
    database: process.env.CAMPAIGN_MYSQL_DATABASE,
    host: process.env.CAMPAIGN_MYSQL_HOST,
    port: Number(process.env.CAMPAIGN_MYSQL_PORT),
    dialect: 'mysql'
  }
};
