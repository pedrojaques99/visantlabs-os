import { toast } from 'sonner';
import { useCreativeStore } from '../store/creativeStore';
import { PASTE_OFFSET_NORMALIZED } from './editorTokens';
import type { CreativeLayer, CreativeLayerData } from '../store/creativeTypes';

/**
 * Single source of truth for layer clipboard. Both keyboard (Ctrl+C/V in
 * CreativeStudio) and the right-click menu route through these helpers so
 * the payload shape, magic tag, and offset semantics stay consistent.
 */

const CLIPBOARD_TAG = 'creative-layers';

interface ClipboardPayload {
  __vsn: typeof CLIPBOARD_TAG;
  layers: CreativeLayer[];
}

export async function copyLayersToClipboard(ids: string[]): Promise<number> {
  const { layers } = useCreativeStore.getState();
  const picked = layers.filter((l) => ids.includes(l.id));
  if (!picked.length) return 0;
  const payload: ClipboardPayload = { __vsn: CLIPBOARD_TAG, layers: picked };
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload));
    toast.info(
      `${picked.length} ${picked.length === 1 ? 'camada copiada' : 'camadas copiadas'}`
    );
    return picked.length;
  } catch {
    toast.error('Falha ao copiar');
    return 0;
  }
}

/**
 * Reads the clipboard, validates payload, and adds layers with a position
 * offset so the paste is visible. Returns ids of newly added layers (so
 * callers can select them).
 */
export async function pasteLayersFromClipboard(): Promise<string[]> {
  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!isClipboardPayload(parsed)) return [];

  const { addLayer } = useCreativeStore.getState();
  const newIds: string[] = [];
  parsed.layers.forEach((l) => {
    const data: CreativeLayerData = {
      ...(l.data as CreativeLayerData),
      position: {
        x: Math.min(0.95, (l.data.position?.x ?? 0) + PASTE_OFFSET_NORMALIZED),
        y: Math.min(0.95, (l.data.position?.y ?? 0) + PASTE_OFFSET_NORMALIZED),
      },
    };
    addLayer(data);
    const after = useCreativeStore.getState().layers;
    newIds.push(after[after.length - 1].id);
  });
  if (newIds.length) {
    toast.info(
      `${parsed.layers.length} ${parsed.layers.length === 1 ? 'camada colada' : 'camadas coladas'}`
    );
  }
  return newIds;
}

function isClipboardPayload(value: unknown): value is ClipboardPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as { __vsn?: unknown; layers?: unknown };
  return v.__vsn === CLIPBOARD_TAG && Array.isArray(v.layers);
}
