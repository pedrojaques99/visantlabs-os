/// <reference types="@figma/plugin-typings" />

import { postToUI } from '../utils/postMessage';
import { ensurePagesLoaded } from '../state';
import { getFolderPath } from './components';

/**
 * Locate components whose name or folder path suggests a logo,
 * export high-res PNG thumbnails, and return them to the UI.
 *
 * UI side then runs heuristic slot detection (light/dark/accent) —
 * sandbox stays dumb: only finds + exports.
 */
const LOGO_NAME_RE = /\blogo(s|marks|type)?\b|\bbrand[-_ ]?mark\b/i;

function matchesLogo(node: ComponentNode | ComponentSetNode): boolean {
  if (LOGO_NAME_RE.test(node.name)) return true;
  const path = getFolderPath(node).join('/');
  return LOGO_NAME_RE.test(path);
}

export async function importLogoCandidates(maxWidth = 512): Promise<void> {
  const results: Array<{ id: string; name: string; thumbnail: string; folderPath: string[] }> = [];

  try {
    await ensurePagesLoaded();
    const nodes = figma.root.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] });
    const candidates = nodes.filter(matchesLogo);

    for (const node of candidates) {
      try {
        const bytes = await node.exportAsync({
          format: 'PNG',
          constraint: { type: 'WIDTH', value: maxWidth }
        });
        const b64 = figma.base64Encode(bytes);
        results.push({
          id: node.id,
          name: node.name,
          thumbnail: `data:image/png;base64,${b64}`,
          folderPath: getFolderPath(node)
        });
      } catch {
        // Skip nodes that fail to export
      }
    }
  } catch (e) {
    console.log('[Plugin] importLogoCandidates failed:', e);
  }

  postToUI({ type: 'LOGO_CANDIDATES_LOADED', candidates: results });
}
