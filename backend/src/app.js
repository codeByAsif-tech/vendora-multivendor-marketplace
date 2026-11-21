import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { sanitizeRequest } from './middlewares/sanitize.js';
import routes from './routes/index.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();

  // Needed behind Render/Railway/Nginx so req.ip and secure cookies work (TRUST_PROXY hops).
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  // API docs (disabled in production). Mounted before helmet because Swagger UI needs its own CSP.
  if (!env.isProduction) {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));
  }

  // Local image storage. Served with either driver, so images saved locally before switching to
  // Cloudinary keep loading (new uploads go to Cloudinary; with no local folder this serves nothing).
  {
    app.use(
      '/uploads',
      express.static(env.uploadRoot, {
        maxAge: '7d',
        index: false,
        dotfiles: 'deny',
        setHeaders(res) {
          res.set('X-Content-Type-Options', 'nosniff');
          res.set('Cross-Origin-Resource-Policy', 'cross-origin');
          res.set('Content-Security-Policy', "default-src 'none'");
        },
      }),
    );
  }

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / server-to-server requests (no Origin header) and listed origins.
        if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    }),
  );

  if (!env.isTest) {
    app.use(
      pinoHttp({
        logger,
        // One short line per request instead of full header dumps.
        serializers: {
          req: (req) => ({ id: req.id, method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        customSuccessMessage: (req, res, responseTime) =>
          `${req.method} ${req.originalUrl} ${res.statusCode} ${Math.round(responseTime)}ms`,
        customErrorMessage: (req, res) => `${req.method} ${req.originalUrl} ${res.statusCode}`,
        autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
      }),
    );
  }

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(sanitizeRequest);

  app.use('/api', apiLimiter);
  app.use('/api/v1', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp();
