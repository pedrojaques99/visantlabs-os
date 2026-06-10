import { getDb } from '../db/mongodb.js';
import type { Collection, Document } from 'mongodb';

interface McpToolCall {
  toolName: string;
  userId: string | null;
  scope: 'read' | 'write' | 'generate';
  durationMs: number;
  success: boolean;
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
  success: boolean
): void {
  const col = getCollection();
  if (!col) return;
  const doc: McpToolCall = { toolName, userId, scope, durationMs, success, createdAt: new Date() };
  col.insertOne(doc).catch(() => {});
}
