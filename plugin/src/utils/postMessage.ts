/// <reference types="@figma/plugin-typings" />

/**
 * Type-safe wrapper for posting messages to UI
 */
export function postToUI(msg: { type: string } & Record<string, unknown>): void {
  figma.ui.postMessage(msg);
}
