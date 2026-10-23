import express from 'express';
import { createRouter } from './routes.js';

export function createApp({ config, store }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  const api = createRouter({ config, store });
  app.use('/v1', api);
  app.use(api);
  return app;
}
