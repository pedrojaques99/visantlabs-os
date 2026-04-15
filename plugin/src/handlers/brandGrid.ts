/// <reference types="@figma/plugin-typings" />

import { applyOperations } from './operations';

interface GridVariation {
  name: string;
  bg: string | null;
  logo: string;
}

interface GridSection {
  id: string;
  title: string;
  variations: GridVariation[];
}

const DEFAULT_SECTIONS: GridSection[] = [
  {
    id: 'fundo',
    title: 'Com Fundo',
    variations: [
      { name: 'Orange BG', bg: '#FF6000', logo: 'white' },
      { name: 'White BG', bg: '#FFFFFF', logo: 'black' },
      { name: 'Dark BG', bg: '#1A1A1A', logo: 'orange' },
      { name: 'Contrast BG', bg: '#000000', logo: 'white' }
    ]
  },
  {
    id: 'isolado',
    title: 'Isolado',
    variations: [
      { name: 'Black Logo', bg: null, logo: '#000000' },
      { name: 'Orange Logo', bg: null, logo: '#FF6000' },
      { name: 'White Logo', bg: null, logo: '#FFFFFF' }
    ]
  }
];

export async function generateBrandGrid(sections: GridSection[] = DEFAULT_SECTIONS) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify('Selecione primeiro um componente ou logo', { error: true });
    return;
  }

  const sourceNode = selection[0];
  const ops: any[] = [];

  ops.push({
    type: 'CREATE_FRAME',
    ref: 'brand_board',
    props: {
      name: `Brand Showcase: ${sourceNode.name}`,
      layoutMode: 'VERTICAL',
      primaryAxisSizingMode: 'AUTO',
      counterAxisSizingMode: 'FIXED',
      width: 1400,
      itemSpacing: 64,
      paddingTop: 80, paddingRight: 80, paddingBottom: 80, paddingLeft: 80,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }]
    }
  });

  for (const section of sections) {
    const sectionRef = `section_${section.id}`;

    ops.push({
      type: 'CREATE_FRAME',
      ref: sectionRef,
      parentRef: 'brand_board',
      props: {
        name: section.title,
        layoutMode: 'VERTICAL',
        itemSpacing: 24,
        fills: []
      }
    });

    ops.push({
      type: 'CREATE_TEXT',
      parentRef: sectionRef,
      props: {
        content: section.title,
        fontSize: 18,
        fontStyle: 'Bold',
        fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }]
      }
    });

    const gridRef = `grid_${section.id}`;
    ops.push({
      type: 'CREATE_FRAME',
      ref: gridRef,
      parentRef: sectionRef,
      props: {
        name: 'Variants Grid',
        layoutMode: 'HORIZONTAL',
        layoutWrap: 'WRAP',
        itemSpacing: 24,
        fills: []
      }
    });

    for (let i = 0; i < section.variations.length; i++) {
      const v = section.variations[i];
      const vRef = `v_${section.id}_${i}`;
      const cardW = 280;
      const cardH = 160;
      const padding = 40;
      const maxW = cardW - padding * 2;
      const maxH = cardH - padding * 2;

      const srcW = 'width' in sourceNode ? sourceNode.width : 100;
      const srcH = 'height' in sourceNode ? sourceNode.height : 100;

      let scale = 1;
      if (srcW > 0 && srcH > 0) {
        scale = Math.min(maxW / srcW, maxH / srcH);
        if (scale > 1) scale = 1;
      }

      const newW = srcW * scale;
      const newH = srcH * scale;

      ops.push({
        type: 'CREATE_FRAME',
        ref: vRef,
        parentRef: gridRef,
        props: {
          name: v.name,
          width: cardW,
          height: cardH,
          fills: v.bg ? [{ type: 'SOLID', color: v.bg }] : [],
          cornerRadius: 4,
          clipsContent: true,
          layoutMode: 'HORIZONTAL',
          primaryAxisAlignItems: 'CENTER',
          counterAxisAlignItems: 'CENTER'
        }
      });

      ops.push({
        type: 'CLONE_NODE',
        sourceNodeId: sourceNode.id,
        parentRef: vRef,
        overrides: { name: 'Logo Instance', width: newW, height: newH }
      });

      if (!v.bg) {
        ops.push({
          type: 'CREATE_TEXT',
          parentRef: vRef,
          props: {
            content: 'Isolado',
            fontSize: 10,
            y: 140,
            x: 10,
            fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }]
          }
        });
      }
    }
  }

  await applyOperations(ops);
  figma.notify(`Brand Grid criado: ${ops.filter((o) => o.type === 'CREATE_FRAME').length} frames`);
}
