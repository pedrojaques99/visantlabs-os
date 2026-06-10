import { useCallback, useState } from 'react';
import { useApi } from './useApi';
import { usePluginStore } from '../store';
import { useFigmaMessages } from './useFigmaMessages';

interface ColorScanItem {
  nodeId: string;
  name: string;
  hex: string;
  parentNodeId?: string;
  textChildren: Array<{ nodeId: string; name: string; content: string }>;
}

interface AIColor {
  index: number;
  hex: string;
  name: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  cmyk: { c: number; m: number; y: number; k: number };
  pantone: string;
}

export type ColorRenameStatus = 'idle' | 'scanning' | 'naming' | 'applying' | 'done' | 'error';

export function useColorRename() {
  const { call } = useApi();
  const { send } = useFigmaMessages();
  const store = usePluginStore();
  const [status, setStatus] = useState<ColorRenameStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ renamed: number } | null>(null);

  const run = useCallback(
    async (opts?: { createVariables?: boolean; createStyles?: boolean }) => {
      const { createVariables = true, createStyles = true } = opts ?? {};
      const linkedId = store.linkedGuideline;

      setStatus('scanning');
      setError(null);
      setResult(null);

      try {
        // Step 1: Scan selection for color swatches via sandbox
        const scanResult = await new Promise<{ items: ColorScanItem[] }>((resolve, reject) => {
          const handler = (ev: MessageEvent) => {
            const msg = ev.data?.pluginMessage;
            if (!msg) return;
            if (msg.ok !== undefined && msg.data?.items) {
              window.removeEventListener('message', handler);
              clearTimeout(timer);
              resolve(msg.data);
            }
            if (msg.type === 'ERROR') {
              window.removeEventListener('message', handler);
              clearTimeout(timer);
              reject(new Error(msg.message));
            }
          };
          const timer = setTimeout(() => {
            window.removeEventListener('message', handler);
            reject(new Error('Scan timed out'));
          }, 15000);
          window.addEventListener('message', handler);

          // Use envelope protocol
          const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
          parent.postMessage(
            {
              pluginMessage: {
                v: 1,
                id,
                op: 'colors.scanForRename',
                payload: {},
              },
            },
            '*'
          );
        });

        if (!scanResult.items.length) {
          setError('No color swatches found in selection');
          setStatus('error');
          return;
        }

        // Step 2: Call server AI to generate names
        setStatus('naming');
        const colors = scanResult.items.map((item) => ({
          hex: item.hex,
          currentName: item.name,
        }));

        const aiResponse = await call('/api/ai/rename-colors', {
          method: 'POST',
          body: JSON.stringify({
            colors,
            brandGuidelineId: linkedId,
          }),
        });

        if (!aiResponse?.colors?.length) {
          setError('AI failed to generate color names');
          setStatus('error');
          return;
        }

        const aiColors: AIColor[] = aiResponse.colors;

        // Step 3: Build rename payload mapping AI names → frame renames + text updates
        setStatus('applying');
        const renames = scanResult.items
          .map((item, idx) => {
            const ai = aiColors[idx];
            if (!ai) return null;

            const num = String(idx + 1).padStart(2, '0');
            const newName = `${num} ${ai.name.toUpperCase()}`;

            // Match text children to their code type and update
            const textUpdates = buildTextUpdates(item.textChildren, ai);

            return {
              nodeId: item.nodeId,
              newName,
              textUpdates,
              createVariable: createVariables,
              createStyle: createStyles,
            };
          })
          .filter(Boolean);

        // Step 4: Apply via sandbox
        const applyResult = await new Promise<{ renamed: number }>((resolve, reject) => {
          const handler = (ev: MessageEvent) => {
            const msg = ev.data?.pluginMessage;
            if (!msg) return;
            if (msg.ok !== undefined && msg.data?.renamed !== undefined) {
              window.removeEventListener('message', handler);
              clearTimeout(timer);
              resolve(msg.data);
            }
            if (msg.type === 'ERROR') {
              window.removeEventListener('message', handler);
              clearTimeout(timer);
              reject(new Error(msg.message));
            }
          };
          const timer = setTimeout(() => {
            window.removeEventListener('message', handler);
            reject(new Error('Apply timed out'));
          }, 30000);
          window.addEventListener('message', handler);

          const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
          parent.postMessage(
            {
              pluginMessage: {
                v: 1,
                id,
                op: 'colors.applyRename',
                payload: { renames },
              },
            },
            '*'
          );
        });

        setResult(applyResult);
        setStatus('done');
        store.showToast(`Renamed ${applyResult.renamed} colors`, 'success');
      } catch (err: any) {
        setError(err.message || 'Failed to rename colors');
        setStatus('error');
        store.showToast(err.message || 'Color rename failed', 'error');
      }
    },
    [call, send, store]
  );

  return { run, status, error, result };
}

function buildTextUpdates(
  textChildren: ColorScanItem['textChildren'],
  ai: AIColor
): Array<{ nodeId: string; content: string }> {
  const updates: Array<{ nodeId: string; content: string }> = [];

  for (const tc of textChildren) {
    const lower = tc.content.toLowerCase().trim();
    const nameLower = tc.name.toLowerCase();

    // Match by content pattern or node name
    if (lower.startsWith('hex') || nameLower.includes('hex')) {
      updates.push({ nodeId: tc.nodeId, content: `HEX ${ai.hex}` });
    } else if (/^r\s*\d/.test(lower) || nameLower.includes('rgb')) {
      updates.push({
        nodeId: tc.nodeId,
        content: `R ${ai.rgb.r} G ${ai.rgb.g} B ${ai.rgb.b}`,
      });
    } else if (/^h\s*\d/.test(lower) || nameLower.includes('hsl')) {
      updates.push({
        nodeId: tc.nodeId,
        content: `H ${ai.hsl.h} S ${ai.hsl.s}% L ${ai.hsl.l}%`,
      });
    } else if (/^c\s*\d/.test(lower) || nameLower.includes('cmyk')) {
      updates.push({
        nodeId: tc.nodeId,
        content: `C ${ai.cmyk.c} M ${ai.cmyk.m} Y ${ai.cmyk.y} K ${ai.cmyk.k}`,
      });
    } else if (lower.startsWith('pantone') || nameLower.includes('pantone')) {
      updates.push({ nodeId: tc.nodeId, content: ai.pantone });
    }
    // Name text node (the big title like "SÓLIDO") - match by being all-uppercase single word
    else if (
      /^[A-ZÀ-ÚÃ-Õ\s]{2,}$/.test(tc.content.trim()) &&
      !tc.content.includes('#') &&
      tc.content.trim().split(/\s+/).length <= 2
    ) {
      updates.push({ nodeId: tc.nodeId, content: ai.name.toUpperCase() });
    }
  }

  return updates;
}
