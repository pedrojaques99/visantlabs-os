/**
 * usePluginOpsChannel — HTTP ops channel client.
 *
 * Lets an external agent drive THIS open plugin: it long-polls
 * GET /api/plugin/pending, applies each queued FigmaOperation batch via the
 * sandbox's existing AGENT_OPS handler, then acks applied batches so they're
 * removed from the Redis queue. Un-acked batches retry on the next poll
 * (at-least-once); applied batch ids are de-duped client-side for idempotency.
 *
 * See docs/PLUGIN_OPS_CHANNEL.md. Mount once (App.tsx).
 */
import { useEffect, useRef } from 'react';
import { usePluginStore } from '../store';
import { apiUrl } from '../config';

const FIGMA_ORIGIN = 'https://www.figma.com';
const BATCH_TIMEOUT_MS = 30_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface QueuedBatch {
  id: string;
  operations: unknown[];
}

export function usePluginOpsChannel() {
  const authToken = usePluginStore((s) => s.authToken);
  const fileIdRef = useRef<string | null>(null);
  const appliedRef = useRef<Set<string>>(new Set());
  const acksRef = useRef<Map<string, (ok: boolean) => void>>(new Map());

  // Capture file key + per-batch ACKs from the sandbox.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const m = event.data?.pluginMessage as any;
      if (!m?.type) return;
      if (m.type === 'FILE_INFO') {
        fileIdRef.current = m.fileId || null;
      } else if (
        (m.type === 'OPERATION_ACK' || m.type === 'OPERATION_ERROR') &&
        typeof m.opId === 'string'
      ) {
        const cb = acksRef.current.get(m.opId);
        if (typeof cb === 'function') cb(m.type === 'OPERATION_ACK');
        acksRef.current.delete(m.opId);
      }
    };
    window.addEventListener('message', onMessage);
    // FILE_INFO is emitted at startup; request again in case we mounted after it.
    parent.postMessage({ pluginMessage: { type: 'GET_FILE_INFO' } }, FIGMA_ORIGIN);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Long-poll → apply → ack loop, active while authenticated.
  useEffect(() => {
    if (!authToken) return;
    let stopped = false;
    let controller: AbortController | null = null;

    const applyBatch = (batch: QueuedBatch) =>
      new Promise<boolean>((resolve) => {
        const opId = batch.id;
        acksRef.current.set(opId, resolve);
        parent.postMessage(
          { pluginMessage: { type: 'AGENT_OPS', operations: batch.operations, opId } },
          FIGMA_ORIGIN
        );
        setTimeout(() => {
          if (acksRef.current.has(opId)) {
            acksRef.current.delete(opId);
            resolve(false);
          }
        }, BATCH_TIMEOUT_MS);
      });

    const loop = async () => {
      while (!stopped) {
        const fileId = fileIdRef.current;
        if (!fileId) {
          await sleep(2000);
          continue;
        }
        try {
          controller = new AbortController();
          const res = await fetch(apiUrl(`/plugin/pending?fileId=${encodeURIComponent(fileId)}`), {
            headers: { Authorization: `Bearer ${authToken}` },
            signal: controller.signal,
          });
          if (!res.ok) {
            await sleep(3000);
            continue;
          }
          const { batches } = (await res.json()) as { batches?: QueuedBatch[] };
          if (Array.isArray(batches) && batches.length > 0) {
            const appliedIds: string[] = [];
            for (const b of batches) {
              if (!b?.id) continue;
              if (appliedRef.current.has(b.id)) {
                appliedIds.push(b.id); // already applied — ack again to clear queue
                continue;
              }
              const ok = await applyBatch(b);
              if (ok) {
                appliedRef.current.add(b.id);
                appliedIds.push(b.id);
              }
            }
            if (appliedIds.length > 0 && !stopped) {
              await fetch(apiUrl('/plugin/ack'), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ fileId, appliedIds }),
              }).catch(() => {});
            }
          }
          // Empty → server already held ~25s (long-poll); loop re-polls immediately.
        } catch {
          if (!stopped) await sleep(3000);
        }
      }
    };

    loop();
    return () => {
      stopped = true;
      controller?.abort();
    };
  }, [authToken]);
}
