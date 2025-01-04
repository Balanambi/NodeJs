// logger.js
const winston = require('winston');

class Logger {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  info(message, meta = {}) {
    this.logger.info(message, { ...meta });
  }

  error(message, error, meta = {}) {
    this.logger.error(message, { error: error?.message || error, stack: error?.stack, ...meta });
  }

  warn(message, meta = {}) {
    this.logger.warn(message, { ...meta });
  }
}

const logger = new Logger();
module.exports = logger;
