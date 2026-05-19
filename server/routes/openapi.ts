/**
 * GET /api/openapi.json
 *
 * Serves the auto-generated OpenAPI 3.1 spec for all MCP tools and legacy REST routes.
 * Public endpoint — no authentication required.
 */

import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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

router.get('/openapi.json', (req, res) => {
  const version = getVersion();
  const serverUrl = `${req.protocol}://${req.get('host')}`;
  const spec = generateMCPOpenAPISpec(version, serverUrl);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(spec);
});

export default router;
