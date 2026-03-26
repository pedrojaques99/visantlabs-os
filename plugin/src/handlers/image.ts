/// <reference types="@figma/plugin-typings" />

import { postToUI } from '../utils/postMessage';

/**
 * Paste generated image to canvas
 */
export async function pasteGeneratedImage(
  imageData: string,
  prompt: string,
  width: number = 800,
  height: number = 450,
  isUrl: boolean = false
) {
  try {
    const page = figma.currentPage;

    // Create frame for the image
    const frame = figma.createFrame();
    frame.name = `Generated: ${prompt.substring(0, 30)}...`;
    frame.resize(width, height);

    // Position near selection or at origin
    frame.x = page.selection.length > 0 ? (page.selection[0] as any).x + 50 : 0;
    frame.y = page.selection.length > 0 ? (page.selection[0] as any).y + 50 : 0;

    // Create rectangle for image
    const rectangle = figma.createRectangle();
    rectangle.resize(width, height);
    rectangle.fills = [];
    frame.appendChild(rectangle);

    // Load image
    let bytes: Uint8Array;

    if (isUrl) {
      try {
        const response = await fetch(imageData);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        bytes = new Uint8Array(arrayBuffer);
      } catch (fetchError) {
        console.error('Failed to fetch image URL, falling back to base64:', fetchError);
        const imageBase64 = imageData.includes(',') ? imageData.split(',')[1] : imageData;
        bytes = figma.base64Decode(imageBase64);
      }
    } else {
      const imageBase64 = imageData.includes(',') ? imageData.split(',')[1] : imageData;
      bytes = figma.base64Decode(imageBase64);
    }

    const imageHash = figma.createImage(bytes).hash;

    // Set the fill
    rectangle.fills = [{
      type: 'IMAGE',
      scaleMode: 'FILL',
      imageHash: imageHash as string,
    } as any];

    // Select and zoom
    page.selection = [frame];
    figma.viewport.scrollAndZoomIntoView([frame]);

    postToUI({
      type: 'IMAGE_PASTED',
      message: 'Imagem colada no canvas!',
      nodeId: frame.id
    });
  } catch (error) {
    console.error('[PasteImage] Error:', error);
    postToUI({
      type: 'IMAGE_PASTE_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Delete current selection
 */
export function deleteSelection() {
  const selection = figma.currentPage.selection;
  for (const node of selection) {
    node.remove();
  }
  postToUI({ type: 'OPERATIONS_DONE', count: selection.length });
}
