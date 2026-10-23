import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './openapi.js';
import { createRouter } from './routes.js';

export function createApp({ config, store }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Registered before the API router, which is mounted at `/` and would otherwise claim these paths.
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'Core Banking API',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  const api = createRouter({ config, store });
  app.use('/v1', api);
  app.use(api);
  return app;
}
