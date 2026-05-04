/// <reference types="@figma/plugin-typings" />

import type { ComponentInfo } from '../../../src/lib/figma-types';
import { postToUI } from '../utils/postMessage';
import { ensurePagesLoaded } from '../state';

/**
 * Get folder path for a node
 */
export function getFolderPath(node: BaseNode): string[] {
  const path: string[] = [];
  let current: BaseNode | null = node.parent;
  while (current && current.type !== 'PAGE') {
    path.unshift(current.name);
    current = current.parent;
  }
  if (current && current.type === 'PAGE') {
    path.unshift(current.name);
  }
  return path;
}

/**
 * Export thumbnail for a component
 */
export async function exportThumbnail(node: ComponentNode | ComponentSetNode): Promise<string | undefined> {
  try {
    const bytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'HEIGHT', value: 64 }
    });
    const b64 = figma.base64Encode(bytes);
    return `data:image/png;base64,${b64}`;
  } catch {
    return undefined;
  }
}

/**
 * Get all components in the current file
 */
export async function getComponentsInCurrentFile(): Promise<ComponentInfo[]> {
  const components: ComponentInfo[] = [];

  try {
    await ensurePagesLoaded();
    const nodes = figma.root.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] });
    const seen = new Set<string>();
    for (const node of nodes) {
      if (!seen.has(node.id)) {
        seen.add(node.id);
        components.push({
          id: node.id,
          name: node.name,
          key: node.key,
          folderPath: getFolderPath(node)
        });
      }
    }
  } catch (e) {
    console.warn('[Plugin] Error finding components:', e);
  }

  return components;
}

/**
 * Export thumbnails for components in batches
 */
export async function exportComponentThumbnails(components: ComponentInfo[]): Promise<void> {
  const BATCH = 12;
  for (let i = 0; i < components.length; i += BATCH) {
    const batch = components.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (comp) => {
        const node = await figma.getNodeByIdAsync(comp.id) as ComponentNode | ComponentSetNode | null;
        if (node) {
          const thumb = await exportThumbnail(node);
          if (thumb) postToUI({ type: 'COMPONENT_THUMBNAIL', componentId: comp.id, thumbnail: thumb });
        }
      })
    );
  }
}

/**
 * Get component from current selection
 */
export async function getComponentFromSelection(): Promise<ComponentInfo | null> {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1) return null;
  const node = sel[0];
  if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
    const thumbnail = await exportThumbnail(node);
    return { id: node.id, name: node.name, key: node.key, folderPath: getFolderPath(node), thumbnail };
  }
  if (node.type === 'INSTANCE') {
    try {
      const main = await node.getMainComponentAsync();
      if (main) {
        const thumbnail = await exportThumbnail(main);
        return { id: main.id, name: main.name, key: main.key, folderPath: main.parent ? getFolderPath(main) : [], thumbnail };
      }
    } catch {
      // Component may not be accessible
    }
  }
  return null;
}

/**
 * Get agent components (from [Agent] pages or [Component] prefix)
 */
export function getAgentComponents(): any[] {
  const components: any[] = [];

  // Look for [Agent] pages
  const agentPages = figma.root.children.filter(
    page => page.name.toLowerCase().startsWith('[agent]')
  );

  // Scan agent pages
  for (const page of agentPages) {
    const pageComps = page.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] });
    for (const comp of pageComps) {
      components.push({
        id: comp.id,
        key: (comp as ComponentNode).key || comp.id,
        name: comp.name,
        description: (comp as ComponentNode).description || '',
        width: comp.width,
        height: comp.height,
      });
    }
  }

  // Scan all pages for [Component] prefixed nodes
  for (const page of figma.root.children) {
    if (agentPages.includes(page)) continue;

    const prefixedComps = page.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] })
      .filter(n => n.name.toLowerCase().startsWith('[component]'));

    for (const comp of prefixedComps) {
      if (!components.some(c => c.id === comp.id)) {
        components.push({
          id: comp.id,
          key: (comp as ComponentNode).key || comp.id,
          name: comp.name,
          description: (comp as ComponentNode).description || '',
          width: comp.width,
          height: comp.height,
        });
      }
    }
  }

  return components;
}
