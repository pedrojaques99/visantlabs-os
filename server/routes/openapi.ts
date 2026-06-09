/**
 * GET  /api/openapi.json  — raw OpenAPI 3.1 spec (public, cacheable)
 * GET  /api/docs          — interactive Swagger UI (try-it-out, API key auth)
 *
 * Public endpoints — no authentication required.
 */

import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import { generateMCPOpenAPISpec } from '../lib/mcp-to-openapi.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
    return pkg.version ?? '1.0.0';
  } catch {
    return '1.0.0';
  }
}

// ── /api/openapi.json — raw spec ─────────────────────────────────────────────
router.get('/openapi.json', (req, res) => {
  const version = getVersion();
  const serverUrl = `${req.protocol}://${req.get('host')}`;
  const spec = generateMCPOpenAPISpec(version, serverUrl);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(spec);
});

// ── /api/docs — Swagger UI ────────────────────────────────────────────────────
const version = getVersion();
const serverUrl = process.env.API_URL ?? 'https://api.visantlabs.com';
const spec = generateMCPOpenAPISpec(version, serverUrl);

const swaggerOptions: swaggerUi.SwaggerUiOptions = {
  explorer: true,
  customSiteTitle: 'Visant API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
    tryItOutEnabled: true,
    filter: true,
    displayRequestDuration: true,
  },
};

router.use('/swagger', swaggerUi.serve, swaggerUi.setup(spec, swaggerOptions));

export default router;
