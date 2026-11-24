import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const apiOrigin = new URL(process.env['ROOMI_API_URL'] ?? 'http://127.0.0.1:8000').origin;

app.use('/api', express.raw({ type: 'application/json', limit: '2mb' }), async (req, res) => {
  try {
    const headers = new Headers();
    for (const name of ['authorization', 'content-type']) {
      const value = req.get(name);
      if (value) headers.set(name, value);
    }
    const response = await fetch(apiOrigin + req.originalUrl, {
      method: req.method,
      headers,
      body: Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    res.set('Cache-Control', 'no-store');
    const challenge = response.headers.get('www-authenticate');
    if (challenge) res.set('WWW-Authenticate', challenge);
    const location = response.headers.get('location');
    if (location) res.set('Location', location);
    const body = await response.text();
    res.status(response.status).type('json').send(body);
  } catch {
    res.status(502).json({ detail: 'La API de ROOMI no está disponible.' });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = Number(process.env['PORT'] || 4000);
  const host = process.env['ROOMI_WEB_HOST'] || '0.0.0.0';
  app.listen(port, host, (error) => {
    if (error) {
      throw error;
    }

    console.log(`ROOMI disponible en http://${host}:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
