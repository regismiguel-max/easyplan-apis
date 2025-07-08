import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.config';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  logger.info(`HTTP ${req.method} ${req.originalUrl}`);
  next();
}
