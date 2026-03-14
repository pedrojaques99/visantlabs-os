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
import { generateMCPSpec, countMCPTools } from '../lib/mcp-gen.js';
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
