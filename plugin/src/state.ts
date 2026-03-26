/// <reference types="@figma/plugin-typings" />

/**
 * Shared plugin state
 */

// Session-level cache for loadAllPagesAsync (performance)
export let pagesLoaded = false;

export function setPagesLoaded(value: boolean) {
  pagesLoaded = value;
}

export async function ensurePagesLoaded() {
  if (!pagesLoaded) {
    await figma.loadAllPagesAsync();
    pagesLoaded = true;
  }
}

// Undo state (official Figma API)
export let canUndo = false;

export function setCanUndo(value: boolean) {
  canUndo = value;
}

// Default font for fallback
export const DEFAULT_FONT: FontName = { family: 'Inter', style: 'Regular' };
