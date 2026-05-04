/// <reference types="@figma/plugin-typings" />

import { postToUI } from '../utils/postMessage';

const SANGRIA_MM = 5;
const MM_TO_PX = 3.7795275591;
const SANGRIA_PX = SANGRIA_MM * MM_TO_PX;

export async function exportWithBleed() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.notify('Selecione pelo menos um frame', { error: true });
    return;
  }

  const frames = selection.filter(
    (n): n is FrameNode | ComponentNode =>
      n.type === 'FRAME' || n.type === 'COMPONENT'
  );

  if (frames.length === 0) {
    figma.notify('Seleção não contém frames', { error: true });
    return;
  }

  const exports: Array<{
    name: string;
    bytes: Uint8Array;
    width_mm: string;
    height_mm: string;
  }> = [];

  for (const node of frames) {
    const wrapper = figma.createFrame();
    wrapper.name = `${node.name}_BLEED`;
    wrapper.resize(node.width + SANGRIA_PX * 2, node.height + SANGRIA_PX * 2);
    wrapper.x = node.x - SANGRIA_PX;
    wrapper.y = node.y - SANGRIA_PX;
    wrapper.fills = [];
    wrapper.clipsContent = false;

    if (
      node.fills &&
      Array.isArray(node.fills) &&
      node.fills.length > 0
    ) {
      const bgRect = figma.createRectangle();
      bgRect.resize(wrapper.width, wrapper.height);
      bgRect.fills = JSON.parse(JSON.stringify(node.fills));
      wrapper.insertChild(0, bgRect);
    }

    const clone = node.clone();
    wrapper.appendChild(clone);
    clone.x = SANGRIA_PX;
    clone.y = SANGRIA_PX;

    try {
      const pdfBytes = await wrapper.exportAsync({ format: 'PDF' });
      exports.push({
        name: `${node.name}.pdf`,
        bytes: pdfBytes,
        width_mm: (wrapper.width / MM_TO_PX).toFixed(1),
        height_mm: (wrapper.height / MM_TO_PX).toFixed(1),
      });
    } catch (err) {
      console.error(`Erro ao exportar ${node.name}:`, err);
    }

    wrapper.remove();
  }

  postToUI({
    type: 'EXPORT_BLEED_BATCH',
    items: exports,
    count: exports.length,
  });

  figma.notify(`${exports.length} PDF(s) com sangria prontos`);
}
