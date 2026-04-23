/// <reference types="@figma/plugin-typings" />

import { postToUI } from '../utils/postMessage';
import { getComponentsInCurrentFile } from './components';
import { getColorVariablesFromFile, getFontVariablesFromFile } from './variables';

/**
 * Notify UI when context changes (selection, etc.)
 */
/**
 * Notify UI when context changes (selection, etc.)
 * Optimized: Only sends selection info. Full context (components/vars) 
 * is handled by GET_CONTEXT or explicit triggers to avoid lag.
 */
export async function notifyContextChange() {
  const selection = figma.currentPage.selection;

  // Build selection info (lightweight)
  const selectionDetails: Array<{ id: string; name: string; type: string; width: number; height: number }> = [];
  for (const node of selection) {
    const width = 'width' in node ? node.width : 0;
    const height = 'height' in node ? node.height : 0;
    selectionDetails.push({ id: node.id, name: node.name, type: node.type, width, height });
  }

  postToUI({
    type: 'CONTEXT_UPDATED',
    selectedElements: selection.length,
    selectionDetails
  });

  // Export thumbnail for single selection (with a check to avoid heavy nodes immediately)
  if (selection.length === 1) {
    const node = selection[0];
    
    // Skip heavy/large nodes for immediate preview if they are too big
    if ('width' in node && (node.width > 5000 || node.height > 5000)) return;

    try {
      const bytes = await node.exportAsync({
        format: 'PNG',
        constraint: { type: 'HEIGHT', value: 64 }
      });
      const b64 = figma.base64Encode(bytes);
      postToUI({
        type: 'SELECTION_THUMBNAIL',
        nodeId: node.id,
        thumbnail: `data:image/png;base64,${b64}`
      });
    } catch {
      // Some nodes can't be exported
    }
  }
}
