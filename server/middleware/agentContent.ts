import { Request, Response, NextFunction } from 'express';

const AI_USER_AGENTS = [
  'ClaudeBot',
  'GPTBot',
  'Anthropic',
  'PerplexityBot',
  'Google-Extended',
  'ChatGPT-User',
  'CCBot',
];

/**
 * Detect if the request is from an AI crawler/agent.
 * Sets res.locals.isAgent = true for downstream handlers.
 * Adds Link header for AI discovery on all responses.
 */
export function detectAgent(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.headers['user-agent'] || '';
  const isAgent = AI_USER_AGENTS.some(bot => userAgent.includes(bot));

  res.locals.isAgent = isAgent;

  // Add Link header for AI discovery
  if (!res.headersSent) {
    res.setHeader('Link', '</llms.txt>; rel="ai-index"');
  }

  next();
}

/**
 * Clean HTML content for AI agents.
 * Strips scripts, styles, nav, footer, decorative attributes.
 * Keeps semantic content.
 */
export function cleanHtmlForAgent(html: string): string {
  // Remove script and style tags with content
  let cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Remove nav, footer tags
  cleaned = cleaned.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  cleaned = cleaned.replace(/<footer[\s\S]*?<\/footer>/gi, '');

  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove decorative attributes
  cleaned = cleaned.replace(/\s(class|style|onclick|onload|data-testid|data-analytics|aria-hidden)="[^"]*"/gi, '');

  // Remove tracking pixels
  cleaned = cleaned.replace(/<img[^>]*width=["']1["'][^>]*>/gi, '');
  cleaned = cleaned.replace(/<img[^>]*height=["']1["'][^>]*>/gi, '');

  // Collapse whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');

  return cleaned.trim();
}
