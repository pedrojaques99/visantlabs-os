/**
 * AI Observability - Structured logging for AI calls
 *
 * Lightweight observability without external dependencies.
 * Logs to console in structured JSON format for easy parsing.
 *
 * Integrates with:
 * - ai-wrapper.ts (automatic tracing)
 * - request-context.ts (request ID correlation)
 */

import { getRequestId } from './request-context.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface AITrace {
  requestId: string;
  provider: 'gemini' | 'claude' | 'openai';
  model?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  cached?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AIMetricsSummary {
  totalCalls: number;
  totalTokens: number;
  estimatedCost: number;
  avgLatency: number;
  errorRate: string;
  byProvider: Record<string, { calls: number; tokens: number }>;
}

// ═══════════════════════════════════════════
// In-memory metrics (reset on restart)
// ═══════════════════════════════════════════

const traces: AITrace[] = [];
const MAX_TRACES = 1000;

let totalCalls = 0;
let totalTokens = 0;
let totalLatency = 0;
let totalErrors = 0;
const providerStats: Record<string, { calls: number; tokens: number }> = {};

// Cost per 1M tokens (estimates)
const COST_PER_1M: Record<string, { input: number; output: number }> = {
  [GEMINI_MODELS.PRO_3_1]: { input: 1.25, output: 5.00 },
  [GEMINI_MODELS.FLASH_3]: { input: 0.10, output: 0.40 },
  [GEMINI_MODELS.FLASH_3_LITE]: { input: 0.05, output: 0.20 },
  [GEMINI_MODELS.FLASH_2_5]: { input: 0.15, output: 0.60 },
  [GEMINI_MODELS.PRO_2_0]: { input: 1.25, output: 5.00 },
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
};

// ═══════════════════════════════════════════
// Trace management
// ═══════════════════════════════════════════

/**
 * Start a new AI trace.
 */
export function startTrace(
  provider: AITrace['provider'],
  operation: string,
  metadata?: Record<string, unknown>
): AITrace {
  const trace: AITrace = {
    requestId: getRequestId(),
    provider,
    operation,
    startTime: Date.now(),
    metadata,
  };

  return trace;
}

/**
 * End a trace and record metrics.
 */
export function endTrace(
  trace: AITrace,
  result: {
    inputTokens?: number;
    outputTokens?: number;
    model?: string;
    cached?: boolean;
    error?: string;
  }
): void {
  trace.endTime = Date.now();
  trace.duration = trace.endTime - trace.startTime;
  trace.inputTokens = result.inputTokens;
  trace.outputTokens = result.outputTokens;
  trace.model = result.model;
  trace.cached = result.cached;
  trace.error = result.error;

  // Calculate cost
  if (result.model && !result.cached && !result.error) {
    const costs = COST_PER_1M[result.model];
    if (costs) {
      const inputCost = ((result.inputTokens || 0) / 1_000_000) * costs.input;
      const outputCost = ((result.outputTokens || 0) / 1_000_000) * costs.output;
      trace.cost = inputCost + outputCost;
    }
  }

  // Update stats
  totalCalls++;
  totalTokens += (result.inputTokens || 0) + (result.outputTokens || 0);
  totalLatency += trace.duration;
  if (result.error) totalErrors++;

  if (!providerStats[trace.provider]) {
    providerStats[trace.provider] = { calls: 0, tokens: 0 };
  }
  providerStats[trace.provider].calls++;
  providerStats[trace.provider].tokens += (result.inputTokens || 0) + (result.outputTokens || 0);

  // Store trace (circular buffer)
  traces.push(trace);
  if (traces.length > MAX_TRACES) {
    traces.shift();
  }

  // Log structured output
  logTrace(trace);
}

/**
 * Log trace in structured format.
 */
function logTrace(trace: AITrace): void {
  const level = trace.error ? 'error' : 'info';
  const log = {
    level,
    type: 'ai_trace',
    requestId: trace.requestId,
    provider: trace.provider,
    model: trace.model,
    operation: trace.operation,
    duration: trace.duration,
    tokens: (trace.inputTokens || 0) + (trace.outputTokens || 0),
    cost: trace.cost?.toFixed(6),
    cached: trace.cached,
    error: trace.error,
  };

  if (process.env.NODE_ENV === 'production') {
    // JSON for log aggregators
    console.log(JSON.stringify(log));
  } else {
    // Human readable for dev
    const status = trace.error ? '❌' : trace.cached ? '📦' : '✅';
    console.log(
      `[AI] ${status} ${trace.provider}/${trace.model || '?'} | ${trace.operation} | ${trace.duration}ms | ${log.tokens} tokens | $${log.cost || '0'}`
    );
  }
}

// ═══════════════════════════════════════════
// Metrics
// ═══════════════════════════════════════════

/**
 * Get summary metrics.
 */
export function getObservabilityMetrics(): AIMetricsSummary {
  return {
    totalCalls,
    totalTokens,
    estimatedCost: traces.reduce((sum, t) => sum + (t.cost || 0), 0),
    avgLatency: totalCalls > 0 ? Math.round(totalLatency / totalCalls) : 0,
    errorRate: totalCalls > 0 ? ((totalErrors / totalCalls) * 100).toFixed(1) + '%' : '0%',
    byProvider: { ...providerStats },
  };
}

/**
 * Get recent traces for debugging.
 */
export function getRecentTraces(limit = 50): AITrace[] {
  return traces.slice(-limit);
}

/**
 * Reset all metrics (for testing).
 */
export function resetMetrics(): void {
  traces.length = 0;
  totalCalls = 0;
  totalTokens = 0;
  totalLatency = 0;
  totalErrors = 0;
  Object.keys(providerStats).forEach(k => delete providerStats[k]);
}

// ═══════════════════════════════════════════
// Convenience wrapper
// ═══════════════════════════════════════════

/**
 * Wrap an AI call with automatic tracing.
 */
export async function withTracing<T>(
  provider: AITrace['provider'],
  operation: string,
  fn: () => Promise<T>,
  options?: {
    model?: string;
    getTokens?: (result: T) => { input?: number; output?: number };
  }
): Promise<T> {
  const trace = startTrace(provider, operation);

  try {
    const result = await fn();

    const tokens = options?.getTokens?.(result) || {};
    endTrace(trace, {
      model: options?.model,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
    });

    return result;
  } catch (error) {
    endTrace(trace, {
      model: options?.model,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
