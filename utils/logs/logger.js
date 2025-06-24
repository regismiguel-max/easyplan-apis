const fs = require('fs');
const path = require('path');
const moment = require('moment');

function createLogger(logGroup = 'api', serviceName = 'default', filePrefix = 'log') {
  const monthFolder = moment().format('YYYY-MM');
  const logsDir = path.resolve(__dirname, '../../logs', logGroup, serviceName, monthFolder);

  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logFilePath = path.join(logsDir, `${filePrefix}-${moment().format('YYYY-MM-DD')}.log`);
  const stream = fs.createWriteStream(logFilePath, { flags: 'a' });

  return (message) => {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const fullMessage = `[${timestamp}] ${message}`;
    console.log(fullMessage);
    stream.write(fullMessage + '\n');
  };
}

module.exports = { createLogger };
