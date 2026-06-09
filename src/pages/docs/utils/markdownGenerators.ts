/**
 * Markdown Generators for DocsPage — re-exports from SSoT
 *
 * The actual generators live in src/lib/docs-markdown.ts (shared between frontend and server).
 * This file re-exports them for backward compatibility with existing DocsPage imports.
 */

export { generateTabMarkdown, generateFullDocsMarkdown } from '@/lib/docs-markdown';
export type { DocsTabId, OpenAPISpec, MCPSpec, MCPTool, PricingData, ApiEndpoint } from '@/lib/docs-markdown';
