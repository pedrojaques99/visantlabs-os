import { getDb } from '../db/mongodb.js';
import type { Collection, Document } from 'mongodb';

interface McpToolCall {
  toolName: string;
  userId: string | null;
  scope: 'read' | 'write' | 'generate';
  durationMs: number;
  success: boolean;
  /**
   * Why the call failed. 'validation' means the SDK rejected the arguments and
   * no handler ran — that's the class of failure that costs an agent a turn,
   * so it's worth telling apart from a handler blowing up. Absent on success.
   */
  errorKind?: 'validation' | 'handler';
  createdAt: Date;
}

let collection: Collection<Document> | null = null;
let indexEnsured = false;

function getCollection(): Collection<Document> | null {
  if (collection) return collection;
  try {
    const db = getDb();
    collection = db.collection('mcp_tool_calls');
    if (!indexEnsured) {
      indexEnsured = true;
      collection.createIndex({ createdAt: -1, toolName: 1 }, { background: true }).catch(() => {});
      collection.createIndex({ userId: 1, createdAt: -1 }, { background: true }).catch(() => {});
    }
    return collection;
  } catch {
    return null;
  }
}

export function trackMcpToolCall(
  toolName: string,
  userId: string | null,
  scope: 'read' | 'write' | 'generate',
  durationMs: number,
  success: boolean,
  errorKind?: 'validation' | 'handler'
): void {
  const col = getCollection();
  if (!col) return;
  const doc: McpToolCall = { toolName, userId, scope, durationMs, success, createdAt: new Date() };
  if (errorKind) doc.errorKind = errorKind;
  col.insertOne(doc).catch(() => {});
}

/**
 * Marker the MCP SDK puts in every input-validation rejection. Not a prefix —
 * the text arrives as "MCP error -32602: Input validation error: ...".
 */
const SDK_VALIDATION_MARKER = 'Input validation error:';

/**
 * Count tool calls the SDK rejects before any handler runs.
 *
 * The scope/telemetry wrapper in platform-mcp.ts replaces the *handler*, but
 * the SDK validates arguments upstream of it (validateToolInput → only then
 * executeToolHandler). So a zod rejection never reached trackMcpToolCall and
 * bad-input failures were invisible — exactly the failures that cost agents a
 * turn. The transport is the first object we own that sees the outgoing
 * response, so they get counted here.
 *
 * Best-effort: never let tracking break a response.
 */
export function trackMcpValidationFailures(
  transport: { send: (message: any, options?: any) => Promise<void> },
  requestBody: unknown,
  userId: string | null,
  scopeOf: (toolName: string) => 'read' | 'write' | 'generate'
): void {
  const messages = Array.isArray(requestBody) ? requestBody : [requestBody];
  const toolByRequestId = new Map<string | number, string>();
  for (const msg of messages) {
    const m = msg as any;
    if (m?.method === 'tools/call' && typeof m?.params?.name === 'string' && m?.id != null) {
      toolByRequestId.set(m.id, m.params.name);
    }
  }
  if (toolByRequestId.size === 0) return;

  const send = transport.send.bind(transport);
  transport.send = async (message: any, options?: any) => {
    try {
      const toolName = message?.id != null ? toolByRequestId.get(message.id) : undefined;
      const text = message?.result?.content?.[0]?.text;
      if (
        toolName &&
        message?.result?.isError === true &&
        typeof text === 'string' &&
        text.includes(SDK_VALIDATION_MARKER)
      ) {
        trackMcpToolCall(toolName, userId, scopeOf(toolName), 0, false, 'validation');
      }
    } catch {
      // tracking is never worth a dropped response
    }
    return send(message, options);
  };
}
