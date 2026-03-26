/// <reference types="@figma/plugin-typings" />

import type { AvailableLayer } from '../../../src/lib/figma-types';

/**
 * Collect referenceable layers for @"name" syntax
 */
export function getAvailableLayers(): AvailableLayer[] {
  const layers: AvailableLayer[] = [];
  const seen = new Set<string>();
  const MAX = 200;

  function addLayer(node: SceneNode) {
    if (seen.has(node.id) || layers.length >= MAX) return;
    seen.add(node.id);
    layers.push({ id: node.id, name: node.name, type: node.type });
  }

  // Selected nodes + their direct children
  const selection = figma.currentPage.selection;
  for (const node of selection) {
    addLayer(node);
    if ('children' in node) {
      for (const child of (node as FrameNode).children) {
        addLayer(child);
      }
    }
  }

  // Top-level nodes on current page
  for (const node of figma.currentPage.children) {
    addLayer(node);
  }

  return layers;
}

export interface ElementsForMentions {
  layers: Array<{ id: string; name: string }>;
  frames: Array<{ id: string; name: string }>;
  components: Array<{ id: string; name: string }>;
  variables: Array<{ id: string; name: string }>;
}

/**
 * Collect all elements for mentions autocomplete
 */
export function getElementsForMentions(): ElementsForMentions {
  const elements: ElementsForMentions = {
    layers: [],
    frames: [],
    components: [],
    variables: [],
  };

  const seenIds = new Set<string>();

  function addElement(node: SceneNode, category: 'layers' | 'frames' | 'components') {
    if (seenIds.has(node.id) || elements[category].length >= 50) return;
    seenIds.add(node.id);
    elements[category].push({ id: node.id, name: node.name });
  }

  const selection = figma.currentPage.selection;

  // Add selected nodes
  for (const node of selection) {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      addElement(node, 'components');
    } else if (node.type === 'FRAME' || node.type === 'SECTION') {
      addElement(node, 'frames');
    } else {
      addElement(node, 'layers');
    }

    // Add direct children
    if ('children' in node) {
      for (const child of (node as FrameNode).children) {
        if (child.type === 'COMPONENT' || child.type === 'COMPONENT_SET') {
          addElement(child, 'components');
        } else if (child.type === 'FRAME' || child.type === 'SECTION') {
          addElement(child, 'frames');
        } else {
          addElement(child, 'layers');
        }
      }
    }
  }

  // Add top-level nodes
  for (const node of figma.currentPage.children) {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      addElement(node, 'components');
    } else if (node.type === 'FRAME' || node.type === 'SECTION') {
      addElement(node, 'frames');
    } else {
      addElement(node, 'layers');
    }
  }

  // Variables
  try {
    const allVariables = (figma.variables as any)?.getAll?.() || [];
    for (const v of allVariables) {
      if (elements.variables.length >= 30) break;
      elements.variables.push({ id: v.id, name: v.name });
    }
  } catch {
    // Variables API may not be available
  }

  return elements;
}
