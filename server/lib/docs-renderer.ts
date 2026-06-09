/**
 * Server-Side Docs Renderer
 * Generates a full HTML documentation page from live API data.
 * Serves crawlable, SEO-ready HTML at /api/docs/full.
 *
 * SSoT: markdown generators come from src/lib/docs-markdown.ts (shared with frontend).
 */

import { marked } from 'marked';
import { generateFullDocsMarkdown } from '../../src/lib/docs-markdown.js';
import type { OpenAPISpec, MCPSpec, PricingData } from '../../src/lib/docs-markdown.js';
import { generateOpenAPISpec } from './openapi-gen.js';
import { generateMCPSpec, generatePlatformMCPSpec } from './mcp-gen.js';
import { getPricingPayload } from './pricing-data.js';
import { docsCache } from './docs-cache.js';

const TTL_RENDERED = 60 * 60 * 1000; // 1h

export function renderFullDocsHTML(version: string, serverUrl: string): string {
  return docsCache.getOrGenerate('docs-full-html', () => {
    const openApiSpec = generateOpenAPISpec(version, serverUrl) as OpenAPISpec;
    const mcpSpec = generateMCPSpec() as MCPSpec;
    const platformSpec = generatePlatformMCPSpec() as MCPSpec;
    const pricing = getPricingPayload() as PricingData;

    const fullMarkdown = generateFullDocsMarkdown(openApiSpec, mcpSpec, platformSpec, pricing);
    const htmlContent = marked.parse(fullMarkdown, { async: false }) as string;

    const platformToolCount = platformSpec?.tools?.length ?? 0;
    const apiEndpointCount = Object.values(openApiSpec?.paths ?? {}).reduce(
      (acc, methods) => acc + Object.keys(methods as object).filter(m =>
        ['get', 'post', 'put', 'delete', 'patch'].includes(m)
      ).length,
      0
    );

    return buildHTMLPage(htmlContent, version, platformToolCount, apiEndpointCount);
  }, TTL_RENDERED);
}

function buildHTMLPage(
  content: string,
  version: string,
  toolCount: number,
  endpointCount: number
): string {
  const title = 'Visant Labs Documentation — API, MCP Tools, Figma Plugin';
  const description = `Complete developer documentation for Visant Labs AI design platform. ${endpointCount}+ REST API endpoints, ${toolCount}+ MCP tools for AI agents, Figma plugin, brand guidelines API, canvas API, and pricing. Brand guidelines as input for AI generation.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="Visant Labs, API documentation, MCP tools, Figma plugin, AI design, brand guidelines, mockup generator, creative AI, canvas API">
  <meta name="robots" content="index, follow">
  <meta name="ai-index" content="https://api.visantlabs.com/llms.txt">
  <meta name="ai-status" content="ready">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="https://www.visantlabs.com/docs">
  <meta property="og:site_name" content="Visant Labs">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">

  <!-- Canonical -->
  <link rel="canonical" href="https://www.visantlabs.com/docs">
  <link rel="ai-index" href="https://api.visantlabs.com/llms.txt">

  <!-- JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": "${title}",
    "description": "${description}",
    "url": "https://www.visantlabs.com/docs",
    "publisher": {
      "@type": "Organization",
      "name": "Visant Labs",
      "url": "https://www.visantlabs.com"
    },
    "about": {
      "@type": "SoftwareApplication",
      "name": "Visant Labs",
      "applicationCategory": "DesignApplication",
      "operatingSystem": "Web"
    },
    "version": "${version}"
  }
  </script>

  <style>
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Red+Hat+Mono:wght@400;500;600&display=swap');

    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg-primary: oklch(1 0 0);
      --bg-secondary: oklch(0.97 0 0);
      --bg-tertiary: oklch(0.922 0 0);
      --text-primary: oklch(0.145 0 0);
      --text-secondary: oklch(0.556 0 0);
      --text-tertiary: oklch(0.708 0 0);
      --border-color: oklch(0.922 0 0);
      --accent-color: oklch(0.81 0.156 198.6);
      --code-bg: oklch(0.97 0 0);
      scrollbar-width: thin;
      scrollbar-color: var(--border-color) transparent;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-primary: oklch(0.145 0 0);
        --bg-secondary: oklch(0.205 0 0);
        --bg-tertiary: oklch(0.269 0 0);
        --text-primary: oklch(0.985 0 0);
        --text-secondary: oklch(0.708 0 0);
        --text-tertiary: oklch(0.556 0 0);
        --border-color: oklch(0.269 0 0);
        --code-bg: oklch(0.205 0 0);
      }
    }

    body {
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.7;
    }

    .docs-header {
      background: color-mix(in srgb, var(--bg-primary), transparent 10%);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 2rem;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .docs-header-inner {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .docs-logo {
      font-weight: 700;
      font-size: 1.25rem;
      color: var(--text-primary);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .docs-logo::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-color);
      box-shadow: 0 0 8px var(--accent-color);
    }

    .docs-nav a {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.875rem;
      margin-left: 1.5rem;
      transition: color 0.15s;
    }

    .docs-nav a:hover { color: var(--accent-color); }

    .docs-main {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 2rem 4rem;
    }

    .docs-main h1 {
      font-size: 2.25rem;
      letter-spacing: -0.025em;
      margin-bottom: 0.5rem;
    }

    .docs-main h2 {
      font-size: 1.625rem;
      margin: 3rem 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border-color);
      letter-spacing: -0.01em;
    }

    .docs-main h3 {
      font-size: 1.2rem;
      margin: 2rem 0 0.75rem;
    }

    .docs-main h4 {
      font-size: 1.05rem;
      margin: 1.5rem 0 0.5rem;
      color: var(--accent-color);
      font-family: 'Red Hat Mono', monospace;
    }

    .docs-main p {
      margin-bottom: 1rem;
      color: var(--text-secondary);
    }

    .docs-main a {
      color: var(--accent-color);
      text-decoration: none;
    }

    .docs-main a:hover { text-decoration: underline; }

    .docs-main ul, .docs-main ol {
      margin-bottom: 1rem;
      padding-left: 1.5rem;
      color: var(--text-secondary);
    }

    .docs-main li { margin-bottom: 0.4rem; }

    .docs-main hr {
      border: none;
      border-top: 1px solid var(--border-color);
      margin: 3rem 0;
    }

    .docs-main table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0 1.5rem;
      font-size: 0.875rem;
    }

    .docs-main th {
      background: var(--bg-tertiary);
      padding: 0.625rem 0.875rem;
      text-align: left;
      font-weight: 600;
      border: 1px solid var(--border-color);
      white-space: nowrap;
    }

    .docs-main td {
      padding: 0.5rem 0.875rem;
      border: 1px solid var(--border-color);
      vertical-align: top;
    }

    .docs-main code {
      font-family: 'Red Hat Mono', monospace;
      font-size: 0.85em;
      background: var(--bg-tertiary);
      padding: 0.15em 0.4em;
      border-radius: 4px;
    }

    .docs-main pre {
      background: var(--code-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      padding: 1rem 1.25rem;
      overflow-x: auto;
      margin: 1rem 0 1.5rem;
    }

    .docs-main pre code {
      background: none;
      padding: 0;
      font-size: 0.8125rem;
      line-height: 1.6;
    }

    .docs-main strong { color: var(--text-primary); }

    .docs-footer {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      border-top: 1px solid var(--border-color);
      color: var(--text-tertiary);
      font-size: 0.8125rem;
      display: flex;
      justify-content: space-between;
    }

    .docs-footer a { color: var(--accent-color); text-decoration: none; }

    @media (max-width: 640px) {
      .docs-main { padding: 1rem; }
      .docs-main h1 { font-size: 1.5rem; }
      .docs-main h2 { font-size: 1.25rem; }
      .docs-nav { display: none; }
      .docs-main table { font-size: 0.75rem; }
    }
  </style>
</head>
<body>
  <header class="docs-header">
    <div class="docs-header-inner">
      <a href="https://www.visantlabs.com" class="docs-logo">Visant Labs</a>
      <nav class="docs-nav">
        <a href="#rest-api">REST API</a>
        <a href="#mcp-tools-figma-plugin">MCP Tools</a>
        <a href="#ai-agent-integration">AI Agents</a>
        <a href="#pricing">Pricing</a>
        <a href="https://www.visantlabs.com/docs">Interactive Docs</a>
      </nav>
    </div>
  </header>

  <main class="docs-main">
    ${content}
  </main>

  <footer class="docs-footer">
    <span>Visant Labs v${version}</span>
    <span>
      <a href="https://api.visantlabs.com/llms.txt">llms.txt</a> &middot;
      <a href="https://api.visantlabs.com/api/docs/api/spec">OpenAPI</a> &middot;
      <a href="https://api.visantlabs.com/.well-known/mcp.json">MCP Discovery</a>
    </span>
  </footer>
</body>
</html>`;
}
