import pino from 'pino';

const nodeEnv = process.env.NODE_ENV || 'development';

export const logger = pino({
  level: nodeEnv === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    censor: '[REDACTED]',
  },
  transport:
    nodeEnv === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
});
