/// <reference types="@figma/plugin-typings" />

import { postToUI } from '../utils/postMessage';
import { getComponentsInCurrentFile } from './components';
import { getColorVariablesFromFile, getFontVariablesFromFile } from './variables';

/**
 * Notify UI when context changes (selection, etc.)
 */
export async function notifyContextChange() {
  const [components, colors, fonts] = await Promise.all([
    getComponentsInCurrentFile(),
    getColorVariablesFromFile(),
    getFontVariablesFromFile()
  ]);
  const selection = figma.currentPage.selection;

  // Build detailed selection info
  const selectionDetails: Array<{ id: string; name: string; type: string; width: number; height: number }> = [];
  for (const node of selection) {
    const width = 'width' in node ? node.width : 0;
    const height = 'height' in node ? node.height : 0;
    selectionDetails.push({ id: node.id, name: node.name, type: node.type, width, height });
  }

  postToUI({
    type: 'CONTEXT_UPDATED',
    selectedElements: selection.length,
    componentsCount: components.length,
    colorVariables: colors.length,
    fontVariables: fonts.length,
    selectionDetails
  });

  // Export thumbnail for single selection
  if (selection.length === 1) {
    const node = selection[0];
    try {
      const bytes = await node.exportAsync({
        format: 'PNG',
        constraint: { type: 'HEIGHT', value: 48 }
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
