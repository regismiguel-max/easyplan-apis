import winston from 'winston';
import path from 'path';

const logDir = path.resolve('logs');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: `${logDir}/app.log`, level: 'info' }),
        new winston.transports.File({ filename: `${logDir}/error.log`, level: 'error' })
    ],
});

export default logger;
