/**
 * Documentation Routes
 * Serves API, MCP, and Plugin documentation with caching and error handling
 *
 * @module routes/docs
 * @description REST API endpoints for accessing Visant Copilot documentation.
 *              Provides HTML pages for humans and JSON specs for LLMs/agents.
 */

import express, { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { generateOpenAPISpec, countEndpoints } from '../lib/openapi-gen.js';
import { generateMCPSpec, generatePlatformMCPSpec, countMCPTools } from '../lib/mcp-gen.js';
import { docsCache } from '../lib/docs-cache.js';
import {
  DocumentationError,
  isDocumentationError,
  ValidationError,
  NotFoundError,
} from '../lib/docs-errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Load template
let template: string;
try {
  template = readFileSync(resolve(__dirname, '../docs/template.html'), 'utf-8');
} catch (e) {
  template = `
    <html>
      <body>
        <h1>Documentation Template Not Found</h1>
        <p>Please ensure server/docs/template.html exists</p>
      </body>
    </html>
  `;
}

const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')
);

const VERSION = packageJson.version || '1.0.0';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';

// ============ Utility Functions ============

/**
 * Set standard response headers for documentation endpoints
 */
function setDocsHeaders(res: Response, ttl: number = 300): void {
  res.set('Cache-Control', `public, max-age=${ttl}`);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
}

/**
 * Validate and sanitize search query
 */
function validateSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new ValidationError('Search query is required');
  }

  const sanitized = query.trim();

  if (sanitized.length < 2) {
    throw new ValidationError('Search query must be at least 2 characters', { length: sanitized.length });
  }

  if (sanitized.length > 100) {
    throw new ValidationError('Search query must not exceed 100 characters', { length: sanitized.length });
  }

  // Basic XSS prevention - no HTML/script tags
  if (/<[^>]*>|<script|<iframe|javascript:/i.test(sanitized)) {
    throw new ValidationError('Invalid characters in search query');
  }

  return sanitized;
}

/**
 * Handle documentation errors with proper HTTP responses
 */
function handleDocsError(err: unknown, res: Response): void {
  console.error('[Docs Error]:', err);

  if (isDocumentationError(err)) {
    setDocsHeaders(res);
    res.status(err.statusCode).json(err.toJSON());
  } else if (err instanceof Error) {
    setDocsHeaders(res);
    res.status(500).json({
      error: err.message,
      code: 'INTERNAL_ERROR',
    });
  } else {
    setDocsHeaders(res);
    res.status(500).json({
      error: 'Unknown error occurred',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * GET /docs
 * Landing page with overview and links
 *
 * Returns an HTML landing page with links to all documentation sections.
 * Includes overview of the platform, key features, and quick start guide.
 */
router.get('/', (req: Request, res: Response) => {
  res.redirect('/docs');
});

/**
 * GET /docs/api
 * REST API documentation
 *
 * Returns HTML documentation for all REST API endpoints,
 * organized by category (Auth, Mockups, Plugin).
 */
router.get('/api', (req: Request, res: Response) => {
  res.redirect('/docs');
});

/**
 * GET /docs/api/spec
 * OpenAPI 3.0 Specification (JSON)
 *
 * Returns the complete OpenAPI 3.0 specification as JSON.
 * Perfect for importing into API tools or generating SDKs.
 */
router.get('/api/spec', (req: Request, res: Response) => {
  try {
    const openAPISpec = docsCache.getOrGenerate(
      'openapi-spec',
      () => generateOpenAPISpec(VERSION, SERVER_URL),
      5 * 60 * 1000
    );

    setDocsHeaders(res, 3600);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-API-Version', VERSION);
    res.json(openAPISpec);
  } catch (err) {
    handleDocsError(err, res);
  }
});

/**
 * GET /docs/plugin
 * Plugin documentation
 *
 * Returns HTML documentation for the Figma plugin,
 * including features, setup guide, and troubleshooting.
 */
router.get('/plugin', (req: Request, res: Response) => {
  res.redirect('/docs');
});

/**
 * GET /docs/plugin/mcp
 * MCP Tools documentation
 *
 * Returns HTML documentation for all MCP tools,
 * with parameters, examples, and integration guides.
 */
router.get('/plugin/mcp', (req: Request, res: Response) => {
  res.redirect('/docs');
});

/**
 * GET /docs/plugin/mcp.json
 * Raw MCP specification for LLMs
 *
 * Returns the complete MCP specification as JSON.
 * Perfect for agents and SDK generation.
 */
router.get('/plugin/mcp.json', (req: Request, res: Response) => {
  try {
    const mcpSpec = docsCache.getOrGenerate(
      'mcp-spec',
      () => generateMCPSpec(),
      5 * 60 * 1000
    );

    setDocsHeaders(res, 3600);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-MCP-Version', '1.0.0');
    res.json(mcpSpec);
  } catch (err) {
    handleDocsError(err, res);
  }
});

/**
 * GET /docs/search
 * Full-text search across documentation
 *
 * Searches API endpoints and MCP tools by keyword.
 * Query parameter: q (minimum 2 characters, maximum 100)
 *
 * @example
 * GET /api/docs/search?q=mockup
 * Returns: { results: [{type: 'endpoint', title: '...', ...}], query: 'mockup' }
 */
router.get('/search', (req: Request, res: Response) => {
  try {
    const queryParam = (req.query.q as string) || '';

    // Validate and sanitize search query
    if (!queryParam || queryParam.trim().length === 0) {
      setDocsHeaders(res);
      res.json({ results: [], query: '', message: 'Search query is required' });
      return;
    }

    const query = validateSearchQuery(queryParam);

    const openAPISpec = docsCache.getOrGenerate(
      'openapi-spec',
      () => generateOpenAPISpec(VERSION, SERVER_URL),
      5 * 60 * 1000
    );

    const mcpSpec = docsCache.getOrGenerate(
      'mcp-spec',
      () => generateMCPSpec(),
      5 * 60 * 1000
    );

    const results = [];

    // Search API endpoints
    for (const [path, methods] of Object.entries(openAPISpec.paths)) {
      for (const [method, details] of Object.entries(methods)) {
        if (
          ['get', 'post', 'put', 'delete', 'patch'].includes(method) &&
          (path.includes(query) ||
            (details.summary && details.summary.toLowerCase().includes(query)) ||
            (details.description && details.description.toLowerCase().includes(query)))
        ) {
          results.push({
            type: 'endpoint',
            title: `${method.toUpperCase()} ${path}`,
            description: details.summary,
            url: `/api/docs/api#${(details.tags || [])[0] || 'api'}`,
          });
        }
      }
    }

    // Search MCP tools
    for (const tool of mcpSpec.tools) {
      if (
        tool.name.includes(query) ||
        tool.description.toLowerCase().includes(query)
      ) {
        results.push({
          type: 'tool',
          title: tool.name,
          description: tool.description,
          url: '/api/docs/plugin/mcp',
        });
      }
    }

    setDocsHeaders(res, 600); // Cache shorter for search results
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({ results, query });
  } catch (err) {
    handleDocsError(err, res);
  }
});

/**
 * GET /docs/export
 * Export documentation in various formats
 *
 * Exports API or MCP specifications as downloadable files.
 * Formats: openapi, mcp
 */
router.get('/export', (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'openapi';

    // Validate format parameter
    if (!['openapi', 'mcp'].includes(format)) {
      throw new ValidationError(
        'Invalid export format. Use: openapi, mcp',
        { format }
      );
    }

    if (format === 'openapi') {
      const spec = docsCache.getOrGenerate(
        'openapi-spec',
        () => generateOpenAPISpec(VERSION, SERVER_URL),
        5 * 60 * 1000
      );

      setDocsHeaders(res, 3600);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="openapi.json"');
      res.json(spec);
    } else if (format === 'mcp') {
      const spec = docsCache.getOrGenerate(
        'mcp-spec',
        () => generateMCPSpec(),
        5 * 60 * 1000
      );

      setDocsHeaders(res, 3600);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="mcp-spec.json"');
      res.json(spec);
    }
  } catch (err) {
    handleDocsError(err, res);
  }
});

/**
 * GET /docs/api/components-usage
 * Component usage metrics from codebase analysis
 *
 * Returns component usage statistics for displaying in design system.
 * Perfect for understanding which components are most critical.
 */
router.get('/api/components-usage', (req: Request, res: Response) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');

    // Load pre-generated metrics
    const metricsPath = path.join(process.cwd(), 'scripts', 'reports', 'component-usage.json');

    fs.readFile(metricsPath, 'utf-8')
      .then((data: string) => {
        const metrics = JSON.parse(data);

        setDocsHeaders(res, 3600); // Cache for 1 hour
        res.json({
          success: true,
          generatedAt: new Date(Date.now()).toISOString(),
          summary: metrics.metadata,
          distribution: metrics.categorized,
          components: (metrics.components || []).map((c: any) => ({
            name: c.name,
            path: c.path,
            imports: c.imports,
            category: c.category,
            usage: {
              percentage: Math.min(100, (c.imports / 167) * 100), // button is 167
              level:
                c.imports > 30
                  ? 'critical'
                  : c.imports > 10
                    ? 'frequent'
                    : c.imports > 2
                      ? 'moderate'
                      : c.imports > 0
                        ? 'rare'
                        : 'unused',
            },
          })),
          topComponents: (metrics.components || []).slice(0, 10),
          orphaned: (metrics.components || []).filter((c: any) => c.imports === 0),
        });
      })
      .catch((err: Error) => {
        console.error('Error reading component metrics:', err);
        setDocsHeaders(res);
        res.status(404).json({
          error: 'Component metrics not available',
          suggestion: 'Run: node scripts/analyze-components.js --json',
          details: err.message,
        });
      });
  } catch (err) {
    handleDocsError(err, res);
  }
});

/**
 * GET /docs/brand
 * Public Brand API documentation
 *
 * Returns HTML documentation for public brand guidelines API endpoints.
 * Includes curl examples, authentication requirements, and response samples.
 */
router.get('/brand', (req: Request, res: Response) => {
  try {
    setDocsHeaders(res, 3600);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brand Guidelines API - Visant Copilot</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --surface: #141414;
      --border: #262626;
      --text: #fafafa;
      --text-muted: #a1a1aa;
      --primary: #8b5cf6;
      --success: #22c55e;
      --warning: #f59e0b;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .subtitle { color: var(--text-muted); margin-bottom: 2rem; }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-public { background: var(--success); color: #000; }
    .badge-auth { background: var(--warning); color: #000; }
    .badge-get { background: #3b82f6; color: #fff; }
    .badge-post { background: #22c55e; color: #fff; }
    section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    h2 { font-size: 1.25rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    h3 { font-size: 1rem; margin: 1.5rem 0 0.5rem; color: var(--text-muted); }
    .endpoint {
      font-family: 'SF Mono', Monaco, monospace;
      background: var(--bg);
      padding: 0.75rem 1rem;
      border-radius: 4px;
      margin: 0.5rem 0;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    pre {
      background: var(--bg);
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 0.875rem;
      font-family: 'SF Mono', Monaco, monospace;
      margin: 0.5rem 0;
    }
    code {
      font-family: 'SF Mono', Monaco, monospace;
      background: var(--bg);
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      font-size: 0.875rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.5rem 0;
    }
    th, td {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    th { color: var(--text-muted); font-weight: 500; }
    .note {
      background: rgba(139, 92, 246, 0.1);
      border-left: 3px solid var(--primary);
      padding: 1rem;
      margin: 1rem 0;
      border-radius: 0 4px 4px 0;
    }
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .response-example {
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Brand Guidelines API</h1>
    <p class="subtitle">Public API for accessing brand guidelines. No authentication required for public endpoints.</p>

    <section>
      <h2>Overview</h2>
      <p>The Brand Guidelines API allows external tools, AI agents, and third-party applications to access brand context programmatically. Public endpoints require no authentication - just a public slug.</p>

      <div class="note">
        <strong>Key Differentiator:</strong> Brand guidelines are INPUT for AI generation, not just OUTPUT documentation. Use these endpoints to inject brand context into your AI workflows.
      </div>
    </section>

    <section>
      <h2><span class="badge badge-public">NO AUTH</span> Public Endpoints</h2>

      <h3>Get Public Brand Guideline</h3>
      <div class="endpoint">
        <span class="badge badge-get">GET</span>
        <span>/api/brand-guidelines/public/{slug}</span>
      </div>
      <p>Returns the full brand guideline data for a public slug.</p>

      <h3>curl Example</h3>
      <pre># Get public brand guideline
curl -X GET "https://api.visantlabs.com/api/brand-guidelines/public/my-brand-slug"</pre>

      <h3>Response Example</h3>
      <pre>{
  "guideline": {
    "_id": "abc123",
    "name": "Acme Corp",
    "isPublic": true,
    "publicSlug": "acme-corp",
    "identity": { "name": "Acme Corp", "tagline": "Innovation First" },
    "colors": { "primary": "#8B5CF6", "secondary": "#22C55E" },
    "typography": { "headings": "Inter", "body": "Inter" },
    "logos": [],
    "guidelines": []
  }
}</pre>
    </section>

    <section>
      <h2><span class="badge badge-public">NO AUTH</span> Brand Context for LLMs</h2>

      <h3>Get Brand Context</h3>
      <div class="endpoint">
        <span class="badge badge-get">GET</span>
        <span>/api/brand-guidelines/public/{slug}/context</span>
      </div>
      <p>Returns LLM-ready formatted brand context. Perfect for AI agents and MCP integrations.</p>

      <h3>Query Parameters</h3>
      <table>
        <tr>
          <th>Parameter</th>
          <th>Type</th>
          <th>Default</th>
          <th>Description</th>
        </tr>
        <tr>
          <td><code>format</code></td>
          <td>string</td>
          <td><code>full</code></td>
          <td><code>full</code> - Complete brand context<br><code>compact</code> - Optimized for image generation</td>
        </tr>
        <tr>
          <td><code>output</code></td>
          <td>string</td>
          <td><code>text</code></td>
          <td><code>text</code> - Plain text for direct LLM injection<br><code>json</code> - Structured JSON with data</td>
        </tr>
      </table>

      <h3>curl Examples</h3>
      <pre># Get full context as plain text (default)
curl "https://api.visantlabs.com/api/brand-guidelines/public/my-brand/context"

# Get compact context as JSON (optimized for image gen)
curl "https://api.visantlabs.com/api/brand-guidelines/public/my-brand/context?format=compact&output=json"

# Get full context as JSON with structured data
curl "https://api.visantlabs.com/api/brand-guidelines/public/my-brand/context?output=json"</pre>

      <h3>Response Example (JSON output)</h3>
      <pre>{
  "slug": "my-brand",
  "brandName": "Acme Corp",
  "format": "compact",
  "context": "Brand: Acme Corp. Primary color: #8B5CF6. Font: Inter...",
  "data": {
    "colors": { "primary": "#8B5CF6", "secondary": "#22C55E" },
    "typography": { "headings": "Inter", "body": "Inter" },
    "guidelines": [],
    "tokens": {}
  }
}</pre>

      <h3>Response Example (Text output)</h3>
      <pre>Brand: Acme Corp
Tagline: Innovation First

Colors:
- Primary: #8B5CF6
- Secondary: #22C55E

Typography:
- Headings: Inter
- Body: Inter

Guidelines:
- Use primary color for CTAs
- Maintain 16px minimum font size</pre>
    </section>

    <section>
      <h2>Use Cases</h2>
      <table>
        <tr>
          <th>Use Case</th>
          <th>Recommended Endpoint</th>
          <th>Parameters</th>
        </tr>
        <tr>
          <td>AI Image Generation</td>
          <td><code>/context</code></td>
          <td><code>format=compact&output=json</code></td>
        </tr>
        <tr>
          <td>LLM Context Injection</td>
          <td><code>/context</code></td>
          <td><code>output=text</code></td>
        </tr>
        <tr>
          <td>MCP Agent Integration</td>
          <td><code>/context</code></td>
          <td><code>output=json</code></td>
        </tr>
        <tr>
          <td>Display Brand Info</td>
          <td><code>/public/{slug}</code></td>
          <td>-</td>
        </tr>
        <tr>
          <td>Agency Client Sharing</td>
          <td><code>/public/{slug}</code></td>
          <td>-</td>
        </tr>
      </table>
    </section>

    <section>
      <h2>Error Responses</h2>
      <table>
        <tr>
          <th>Status</th>
          <th>Description</th>
          <th>Response</th>
        </tr>
        <tr>
          <td><code>404</code></td>
          <td>Brand not found or not public</td>
          <td><code>{ "error": "Brand guideline not found or not public" }</code></td>
        </tr>
        <tr>
          <td><code>429</code></td>
          <td>Rate limit exceeded</td>
          <td><code>{ "error": "Too many requests" }</code></td>
        </tr>
        <tr>
          <td><code>500</code></td>
          <td>Server error</td>
          <td><code>{ "error": "Failed to fetch public guideline" }</code></td>
        </tr>
      </table>
    </section>

    <section>
      <h2>Related Resources</h2>
      <ul>
        <li><a href="/api/docs/api/spec">OpenAPI Specification</a> - Full API spec (JSON)</li>
        <li><a href="/api/docs/plugin/mcp.json">MCP Specification</a> - MCP tools for agents</li>
        <li><a href="/api/docs/search?q=brand">Search API Docs</a> - Search for brand endpoints</li>
      </ul>
    </section>

    <footer style="text-align: center; margin-top: 2rem; color: var(--text-muted);">
      <p>Visant Copilot API v${VERSION}</p>
    </footer>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    handleDocsError(err, res);
  }
});

/**
 * GET /docs/platform/mcp.json
 * Platform MCP spec — 28 tools for Claude.ai Connectors
 */
router.get('/platform/mcp.json', (req: Request, res: Response) => {
  try {
    const mcpSpec = docsCache.getOrGenerate(
      'platform-mcp-spec',
      () => generatePlatformMCPSpec(),
      5 * 60 * 1000
    );

    setDocsHeaders(res, 3600);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-MCP-Version', '2025-03-26');
    res.json(mcpSpec);
  } catch (err) {
    handleDocsError(err, res);
  }
});

/**
 * GET /docs/api/api-keys
 * API Keys documentation
 */
router.get('/api/api-keys', (_req: Request, res: Response) => {
  setDocsHeaders(res, 3600);
  res.json({
    title: 'API Keys',
    description: 'Manage API keys for programmatic access and MCP integrations.',
    endpoint: '/api/api-keys',
    authentication: 'JWT required (user session)',
    operations: [
      {
        method: 'POST',
        path: '/api/api-keys/create',
        description: 'Create a new API key. Raw key returned once — save it.',
        body: {
          name: 'string (required, max 100 chars)',
          scopes: 'string[] (optional) — "read" | "write" | "generate"',
          expiresAt: 'ISO date string (optional)',
        },
        response: { id: 'string', key: 'visant_sk_xxx (shown once)', keyPrefix: 'string', name: 'string', scopes: 'string[]', expiresAt: 'string|null' },
      },
      {
        method: 'GET',
        path: '/api/api-keys',
        description: 'List all API keys for the authenticated user.',
        response: { keys: [{ id: 'string', keyPrefix: 'string', name: 'string', scopes: 'string[]', lastUsed: 'string|null', createdAt: 'string', expiresAt: 'string|null', active: 'boolean' }] },
      },
      {
        method: 'DELETE',
        path: '/api/api-keys/:id',
        description: 'Revoke an API key (soft delete).',
        response: { message: 'API key revoked' },
      },
    ],
    usage: {
      header: 'Authorization: Bearer visant_sk_xxx',
      mcp_endpoint: '/api/mcp',
      note: 'API keys are used for MCP server access and programmatic REST API calls.',
    },
  });
});

/**
 * GET /docs/api/component/:name
 * Get usage details for a specific component
 */
router.get('/api/component/:name', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const fs = require('fs').promises;
    const path = require('path');

    const metricsPath = path.join(process.cwd(), 'scripts', 'reports', 'component-usage.json');

    fs.readFile(metricsPath, 'utf-8')
      .then((data: string) => {
        const metrics = JSON.parse(data);
        const component = (metrics.components || []).find(
          (c: any) => c.name.toLowerCase() === name.toLowerCase()
        );

        if (component) {
          setDocsHeaders(res, 3600);
          res.json({
            success: true,
            component: {
              ...component,
              usage: {
                percentage: Math.min(100, (component.imports / 167) * 100),
                level:
                  component.imports > 30
                    ? 'critical'
                    : component.imports > 10
                      ? 'frequent'
                      : component.imports > 2
                        ? 'moderate'
                        : component.imports > 0
                          ? 'rare'
                          : 'unused',
              },
            },
          });
        } else {
          setDocsHeaders(res);
          res.status(404).json({ error: `Component '${name}' not found` });
        }
      })
      .catch((err: Error) => {
        setDocsHeaders(res);
        res.status(500).json({ error: 'Failed to read component metrics', details: err.message });
      });
  } catch (err) {
    handleDocsError(err, res);
  }
});

export default router;
