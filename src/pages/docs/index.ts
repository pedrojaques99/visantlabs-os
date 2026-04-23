/**
 * Docs Module - Re-exports for DocsPage
 */

// Navigation
export { DOCS_NAVIGATION_ITEMS, buildNavigationWithMcpTools } from './data/navigationItems';

// Pricing static data — used by PricingPage and SubscriptionPlansGrid (sync UI components)
// For DocsPage markdown, use pricingData from useDocsData() instead
export { STORAGE_PLANS, getCreditsEstimate } from './data/pricingData';
export type { PricingTier, CreditPackage, StoragePlan } from './data/pricingData';

// Hooks
export { useDocsData } from './hooks/useDocsData';
export type { OpenAPISpec, MCPSpec, MCPTool, ApiEndpoint, PricingData } from './hooks/useDocsData';

// Utils
export { generateTabMarkdown } from './utils/markdownGenerators';
