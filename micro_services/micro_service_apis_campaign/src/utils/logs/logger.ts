// utils/logger.ts
import fs from 'fs';
import path from 'path';
import moment from 'moment';

/**
 * Cria um logger que salva mensagens com timestamp em arquivos organizados por mês.
 * @param logGroup - Nome do grupo de logs (ex: 'api')
 * @param serviceName - Nome do serviço (ex: 'default')
 * @param filePrefix - Prefixo do nome do arquivo de log (ex: 'log')
 * @returns Uma função para logar mensagens com timestamp
 */
export function createLogger(
  logGroup: string = 'api',
  serviceName: string = 'default',
  filePrefix: string = 'log'
): (message: string) => void {
  const monthFolder = moment().format('YYYY-MM');
  const baseLogsPath = path.resolve(__dirname, '../../../../../logs');
  const logsDir = path.join(baseLogsPath, logGroup, serviceName, monthFolder);

  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logFilePath = path.join(logsDir, `${filePrefix}-${moment().format('YYYY-MM-DD')}.log`);
  const stream = fs.createWriteStream(logFilePath, { flags: 'a' });

  return (message: string): void => {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const fullMessage = `[${timestamp}] ${message}`;
    console.log(fullMessage);
    stream.write(fullMessage + '\n');
  };
}
