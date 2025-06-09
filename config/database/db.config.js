const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

console.log('🌱 DB selecionado:', process.env.MYSQL_DATABASE);

module.exports = {
    HOST: process.env.MYSQL_HOST,
    USER: process.env.MYSQL_USER,
    PASSWORD: process.env.MYSQL_PASSWORD,
    DB: process.env.MYSQL_DATABASE,
    dialect: "mysql",
    timezone: '-03:00',
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};