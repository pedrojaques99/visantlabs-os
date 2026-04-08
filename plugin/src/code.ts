/// <reference types="@figma/plugin-typings" />
/**
 * Visant Copilot - Figma Plugin
 * Main entry point - routes messages to handlers
 */

import type { UIMessage } from '../../src/lib/figma-types';
import { postToUI } from './utils/postMessage';
import { serializeSelection, serializePage, getEnrichedContext } from './utils/serialize';
import { getAvailableLayers, getElementsForMentions } from './utils/layers';
import { canUndo, setCanUndo } from './state';
import {
  applyOperations,
  getComponentsInCurrentFile,
  exportComponentThumbnails,
  getComponentFromSelection,
  getAgentComponents,
  getColorVariablesFromFile,
  getFontVariablesFromFile,
  getAvailableFontFamilies,
  notifyContextChange,
  getTemplates,
  scaffoldAgentLibrary,
  pasteGeneratedImage,
  deleteSelection,
  saveApiKey,
  getApiKey,
  saveAnthropicKey,
  getAnthropicKey,
  saveAuthToken,
  getAuthToken,
  getGuidelines,
  saveGuideline,
  deleteGuideline,
  getDesignSystem,
  saveDesignSystem,
  getBrandGuideline,
  saveBrandGuideline,
  linkGuideline,
  saveLocalBrandConfig,
  getLocalBrandConfig,
  extractForSync,
  pushToFigma,
  applyBrandGuidelinesLocally,
  createStickyPrompt,
  varySelectionColors,
  selectionToSlices,
  lintBrandAdherence,
  focusNode,
  fixBrandIssues,
  multiplyResponsive
} from './handlers/index';

// ═══ Initialize UI ═══
figma.showUI(__html__, { width: 420, height: 680, themeColors: true, title: 'Visant Copilot' });

// Send current user info to UI
const currentUser = figma.currentUser;
if (currentUser) {
  postToUI({
    type: 'USER_INFO',
    user: {
      id: currentUser.id,
      name: currentUser.name,
      photoUrl: currentUser.photoUrl
    }
  });
}

// ═══ Selection change listener ═══
figma.on('selectionchange', notifyContextChange);

// ═══ Message handler ═══
figma.ui.onmessage = async (msg: UIMessage) => {

  // ── Agent Operations (WebSocket from server) ──
  if (msg.type === 'AGENT_OPS') {
    try {
      const { operations, opId } = msg as any;
      await applyOperations(operations);
      postToUI({ type: 'OPERATION_ACK', opId, success: true, appliedCount: operations.length });
      console.log(`[Agent] Applied ${operations.length} operations (opId=${opId})`);
    } catch (err) {
      const { opId } = msg as any;
      postToUI({ type: 'OPERATION_ERROR', opId, error: err instanceof Error ? err.message : String(err) });
      console.error(`[Agent] Operation failed (opId=${opId}):`, err);
    }
    return;
  }

  // ── WebSocket initialization ──
  if (msg.type === 'INIT_WS') {
    console.log('[Plugin] WebSocket initialization message received');
    return;
  }

  // ── Undo last batch ──
  if (msg.type === 'UNDO_LAST_BATCH') {
    if (canUndo) {
      figma.triggerUndo();
      setCanUndo(false);
      postToUI({ type: 'UNDO_RESULT', success: true, message: 'Última operação desfeita com sucesso.', canUndo: false });
    } else {
      postToUI({ type: 'UNDO_RESULT', success: false, message: 'Nenhuma operação para desfazer.', canUndo: false });
    }
    return;
  }

  // ── Selection change notification ──
  if (msg.type === 'REPORT_SELECTION') {
    const selection = figma.currentPage.selection;
    const nodes = selection.map(n => ({ name: n.name, id: n.id, type: n.type }));
    postToUI({ type: 'SELECTION_CHANGED', nodes });
    return;
  }

  // Smart scan: analyze multi-selection and classify each node
  if (msg.type === 'SMART_SCAN_SELECTION') {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      postToUI({ type: 'SMART_SCAN_RESULT', items: [], error: 'Nothing selected' });
      return;
    }

    const items: any[] = [];
    for (const node of selection) {
      const item: any = {
        id: node.id,
        name: node.name,
        type: node.type,
        width: Math.round(node.width),
        height: Math.round(node.height),
        category: 'unknown', // will be classified
      };

      // ── Name-based pattern helpers ──
      const nameLower = node.name.toLowerCase().replace(/[-_/\\]/g, ' ');

      // Logo patterns (EN + PT)
      const isLogoName = /\b(logo|logotipo|logomarca|brand|marca|mark|emblem|badge|brasao|escudo|selo)\b/.test(nameLower);

      // Color name patterns — known color words + role words (EN + PT)
      const isColorName = /\b(primary|secondary|accent|neutral|surface|background|foreground|danger|warning|success|info|error|muted|destructive|primari[ao]|secundari[ao]|fundo|superficie|destaque|cor |color)\b/.test(nameLower)
        || /\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|vermelho|azul|verde|amarelo|laranja|roxo|rosa|preto|branco|cinza)\b/.test(nameLower);

      // Button / UI component patterns (EN + PT)
      const isButtonName = /\b(button|btn|bot[aã]o|cta)\b/.test(nameLower);
      const isIconName = /\b(icon|icone|ícone|glyph)\b/.test(nameLower);

      // Guess color role from name
      const guessColorRole = (n: string): string => {
        const l = n.toLowerCase().replace(/[-_/\\]/g, ' ');
        if (/\b(primary|primari[ao])\b/.test(l)) return 'primary';
        if (/\b(secondary|secundari[ao])\b/.test(l)) return 'secondary';
        if (/\b(accent|destaque)\b/.test(l)) return 'accent';
        if (/\b(background|fundo|bg)\b/.test(l)) return 'background';
        if (/\b(surface|superficie)\b/.test(l)) return 'surface';
        if (/\b(danger|error|destructive|erro)\b/.test(l)) return 'danger';
        if (/\b(warning|aviso|alerta)\b/.test(l)) return 'warning';
        if (/\b(success|sucesso)\b/.test(l)) return 'success';
        if (/\b(info|informa)\b/.test(l)) return 'info';
        if (/\b(muted|neutral|neutro|cinza|gray|grey)\b/.test(l)) return 'neutral';
        if (/\b(foreground|texto|text|fore)\b/.test(l)) return 'foreground';
        return '';
      };

      // ── Classify by type + name heuristics ──

      if (node.type === 'TEXT') {
        // Text node → font capture
        const textNode = node as TextNode;
        const font = textNode.fontName as FontName;
        item.category = 'font';
        item.fontData = {
          id: `${font.family}-${font.style}`,
          name: `${font.family} ${font.style}`,
          family: font.family,
          style: font.style,
          size: typeof textNode.fontSize === 'number' ? textNode.fontSize : undefined,
        };
        // Guess role from name or size
        const size = typeof textNode.fontSize === 'number' ? textNode.fontSize : 0;
        if (nameLower.includes('heading') || nameLower.includes('title') || nameLower.includes('titulo') || nameLower.includes('h1') || nameLower.includes('h2') || nameLower.includes('h3') || size >= 24) {
          item.suggestedRole = 'heading';
        } else if (nameLower.includes('body') || nameLower.includes('paragraph') || nameLower.includes('corpo') || nameLower.includes('texto') || nameLower.includes('text')) {
          item.suggestedRole = 'body';
        } else if (nameLower.includes('caption') || nameLower.includes('label') || nameLower.includes('small') || nameLower.includes('legenda') || nameLower.includes('rodape') || size <= 12) {
          item.suggestedRole = 'caption';
        } else {
          item.suggestedRole = 'body';
        }
      } else if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'INSTANCE') {
        // Component → classify by name first, then fallback to heuristics
        let comp = node;
        if (node.type === 'INSTANCE') {
          try { const main = await (node as InstanceNode).getMainComponentAsync(); if (main) comp = main; } catch {}
        }

        // Name takes priority for classification
        const compNameLower = comp.name.toLowerCase().replace(/[-_/\\]/g, ' ');
        const isLogo = isLogoName
          || /\b(logo|logotipo|brand|marca|mark|emblem)\b/.test(compNameLower)
          || (!isButtonName && !isIconName && !isColorName
            && item.width <= 400 && item.height <= 400
            && item.width / item.height > 0.3 && item.width / item.height < 3);

        // Export thumbnail for all component types
        try {
          const bytes = await (comp as SceneNode).exportAsync({ format: 'PNG', constraint: { type: 'HEIGHT', value: 64 } });
          item.thumbnail = `data:image/png;base64,${figma.base64Encode(bytes)}`;
        } catch {}
        item.componentData = { id: comp.id, name: comp.name, key: (comp as any).key };

        if (isLogo) {
          item.category = 'logo';
        } else {
          item.category = 'component';
          // Enrich with sub-type hint for UI
          if (isButtonName) item.componentHint = 'button';
          else if (isIconName) item.componentHint = 'icon';
        }
      } else if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
        const fills = ('fills' in node) ? (node as any).fills : [];
        const solidFills = Array.isArray(fills) ? fills.filter((f: any) => f.type === 'SOLID' && f.visible !== false) : [];

        // Name says it's a color? Force color category even for larger shapes
        if (isColorName && solidFills.length >= 1) {
          const fill = solidFills[0];
          const r = Math.round(fill.color.r * 255);
          const g = Math.round(fill.color.g * 255);
          const b = Math.round(fill.color.b * 255);
          item.category = 'color';
          item.colorData = {
            hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase(),
            name: node.name,
            role: guessColorRole(node.name),
          };
        } else if (solidFills.length === 1 && item.width <= 200 && item.height <= 200) {
          // Small shape with single fill → likely color swatch
          const fill = solidFills[0];
          const r = Math.round(fill.color.r * 255);
          const g = Math.round(fill.color.g * 255);
          const b = Math.round(fill.color.b * 255);
          item.category = 'color';
          item.colorData = {
            hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase(),
            name: node.name,
            role: guessColorRole(node.name),
          };
        } else if (isLogoName) {
          // Name says logo
          item.category = 'logo';
          try {
            const bytes = await (node as SceneNode).exportAsync({ format: 'PNG', constraint: { type: 'HEIGHT', value: 64 } });
            item.thumbnail = `data:image/png;base64,${figma.base64Encode(bytes)}`;
          } catch {}
          item.componentData = { id: node.id, name: node.name, key: '' };
        } else {
          // Fallback: treat as potential logo
          item.category = 'logo';
          try {
            const bytes = await (node as SceneNode).exportAsync({ format: 'PNG', constraint: { type: 'HEIGHT', value: 64 } });
            item.thumbnail = `data:image/png;base64,${figma.base64Encode(bytes)}`;
          } catch {}
          item.componentData = { id: node.id, name: node.name, key: '' };
        }
      }

      items.push(item);
    }

    postToUI({ type: 'SMART_SCAN_RESULT', items });
    return;
  }

  if (msg.type === 'USE_SELECTION_AS_LOGO') {
    const comp = await getComponentFromSelection();
    postToUI({ type: 'SELECTION_LOGO_RESULT', component: comp });
    return;
  }

  // Export a node as SVG (or PNG fallback) for uploading to webapp
  if (msg.type === 'EXPORT_NODE_IMAGE') {
    const { nodeId, format } = msg;
    try {
      let node: BaseNode | null = null;
      if (nodeId === 'selection') {
        const selection = figma.currentPage.selection;
        if (selection.length > 0) {
          node = selection[0];
        }
      } else {
        node = await figma.getNodeByIdAsync(nodeId);
      }

      if (!node || !('exportAsync' in node)) {
        postToUI({ type: 'EXPORT_NODE_IMAGE_RESULT', nodeId, error: 'Node not found or not exportable' });
        return;
      }
      const exportNode = node as SceneNode;
      if (format === 'SVG') {
        const bytes = await exportNode.exportAsync({ format: 'SVG' });
        const b64 = figma.base64Encode(bytes);
        postToUI({ type: 'EXPORT_NODE_IMAGE_RESULT', nodeId, data: `data:image/svg+xml;base64,${b64}`, format: 'SVG' });
      } else {
        const bytes = await exportNode.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
        const b64 = figma.base64Encode(bytes);
        postToUI({ type: 'EXPORT_NODE_IMAGE_RESULT', nodeId, data: `data:image/png;base64,${b64}`, format: 'PNG' });
      }
    } catch (e: any) {
      postToUI({ type: 'EXPORT_NODE_IMAGE_RESULT', nodeId, error: e.message || 'Export failed' });
    }
    return;
  }

  if (msg.type === 'USE_SELECTION_AS_FONT') {
    const selection = figma.currentPage.selection;
    let fontInfo = null;

    if (selection.length > 0) {
      const node = selection[0];
      if (node.type === 'TEXT') {
        const font = node.fontName as FontName;
        // Return family-level info — let UI resolve available styles from allFonts
        fontInfo = {
          id: font.family,
          name: font.family,
          family: font.family,
          style: font.style
        };
      }
    }

    postToUI({ type: 'SELECTION_FONT_RESULT', font: fontInfo });
    return;
  }

  if (msg.type === 'CAPTURE_COMPONENT_SELECTION') {
    const comp = await getComponentFromSelection();
    postToUI({ type: 'COMPONENT_CAPTURED', component: comp });
    return;
  }

  // ── Elements for mentions autocomplete ──
  if (msg.type === 'GET_ELEMENTS_FOR_MENTIONS') {
    const elements = getElementsForMentions();
    postToUI({ type: 'ELEMENTS_FOR_MENTIONS', ...elements });
    return;
  }

  // ── Templates ──
  if (msg.type === 'GET_TEMPLATES') {
    getTemplates((msg as any).requestId);
    return;
  }

  // ── Agent components ──
  if (msg.type === 'GET_AGENT_COMPONENTS') {
    const components = getAgentComponents();
    postToUI({ type: 'AGENT_COMPONENTS_RESULT', components });
    return;
  }

  // ── Scaffold agent library ──
  if (msg.type === 'SCAFFOLD_AGENT_LIBRARY') {
    await scaffoldAgentLibrary((msg as any).brand);
    return;
  }

  // ── Select and zoom to node ──
  if (msg.type === 'SELECT_AND_ZOOM') {
    try {
      const node = await figma.getNodeByIdAsync((msg as any).nodeId);
      if (node && 'parent' in node) {
        figma.currentPage.selection = [node as SceneNode];
        figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
      }
    } catch {
      // Node may have been deleted
    }
    return;
  }

  // ── Get context ──
  if (msg.type === 'GET_CONTEXT') {
    const [components, colors, fonts] = await Promise.all([
      getComponentsInCurrentFile(),
      getColorVariablesFromFile(),
      getFontVariablesFromFile()
    ]);
    const selection = figma.currentPage.selection;

    postToUI({
      type: 'CONTEXT_UPDATED',
      selectedElements: selection.length,
      componentsCount: components.length,
      colorVariables: colors.length,
      fontVariables: fonts.length
    });

    postToUI({ type: 'COMPONENTS_LOADED', components });
    postToUI({ type: 'FONT_VARIABLES_LOADED', fonts });
    postToUI({ type: 'COLOR_VARIABLES_LOADED', colors });

    exportComponentThumbnails(components).catch(() => {});
    getAvailableFontFamilies().then((families: any) => {
      postToUI({ type: 'AVAILABLE_FONTS_LOADED', families });
    }).catch(() => {});
    return;
  }

  // ── Get enriched context (for AI) ──
  if (msg.type === 'GET_ENRICHED_CONTEXT') {
    const context = await getEnrichedContext();
    postToUI({ type: 'ENRICHED_CONTEXT', payload: context });
    return;
  }

  // ── Apply operations ──
  if (msg.type === 'APPLY_OPERATIONS') {
    await applyOperations(msg.payload);
    return;
  }

  if (msg.type === 'APPLY_OPERATIONS_FROM_API') {
    await applyOperations(msg.operations);
    return;
  }

  // ── Generate with context ──
  if (msg.type === 'GENERATE_WITH_CONTEXT') {
    const useScanPage = !!(msg as any).scanPage;
    const [components, colors, fonts, contextData] = await Promise.all([
      getComponentsInCurrentFile(),
      getColorVariablesFromFile(),
      getFontVariablesFromFile(),
      useScanPage ? serializePage() : serializeSelection()
    ]);

    const availableLayers = getAvailableLayers();
    const context = {
      command: msg.command,
      fileId: figma.fileKey || 'local_file',
      selectedElements: contextData.nodes,
      scanPage: useScanPage,
      availableComponents: components,
      availableColorVariables: colors,
      availableFontVariables: fonts,
      availableLayers,
      selectedLogo: msg.logoComponent,
      brandLogos: (msg as any).brandLogos || null,
      selectedBrandFont: msg.brandFont,
      brandFonts: (msg as any).brandFonts || null,
      selectedBrandColors: msg.brandColors,
      designSystem: (msg as any).designSystem || null,
      thinkMode: (msg as any).thinkMode || false,
      useBrand: (msg as any).useBrand !== undefined ? (msg as any).useBrand : true,
      mentions: (msg as any).mentions || [],
      attachments: (msg as any).attachments || []
    };

    postToUI({ type: 'CALL_API', context });
    return;
  }

  // ── Image paste ──
  if (msg.type === 'PASTE_GENERATED_IMAGE') {
    await pasteGeneratedImage(msg.imageData, msg.prompt, msg.width || 800, msg.height || 450, msg.isUrl || false);
    return;
  }

  // ── Delete selection ──
  if (msg.type === 'DELETE_SELECTION') {
    deleteSelection();
    return;
  }

  // ── Open external URL ──
  if (msg.type === 'OPEN_EXTERNAL') {
    figma.openExternal(msg.url);
    return;
  }

  // ── API Keys ──
  if (msg.type === 'SAVE_API_KEY') {
    await saveApiKey(msg.key);
    return;
  }

  if (msg.type === 'GET_API_KEY') {
    await getApiKey();
    return;
  }

  if (msg.type === 'SAVE_ANTHROPIC_KEY') {
    await saveAnthropicKey(msg.key);
    return;
  }

  if (msg.type === 'GET_ANTHROPIC_KEY') {
    await getAnthropicKey();
    return;
  }

  // ── Auth Token ──
  if (msg.type === 'SAVE_AUTH_TOKEN') {
    await saveAuthToken((msg as any).token || '');
    return;
  }

  if (msg.type === 'GET_AUTH_TOKEN') {
    await getAuthToken();
    return;
  }

  // ── Guidelines ──
  if (msg.type === 'GET_GUIDELINES') {
    getGuidelines();
    return;
  }

  if (msg.type === 'SAVE_GUIDELINE') {
    saveGuideline(msg.guideline);
    return;
  }

  if (msg.type === 'DELETE_GUIDELINE') {
    deleteGuideline(msg.id);
    return;
  }

  // ── Design System ──
  if (msg.type === 'GET_DESIGN_SYSTEM') {
    getDesignSystem();
    return;
  }

  if (msg.type === 'SAVE_DESIGN_SYSTEM') {
    saveDesignSystem(msg.designSystem);
    return;
  }

  // ── Brand Guideline ──
  if (msg.type === 'GET_BRAND_GUIDELINE') {
    getBrandGuideline();
    return;
  }

  if (msg.type === 'SAVE_BRAND_GUIDELINE') {
    saveBrandGuideline(msg.selectedId, msg.guideline);
    return;
  }

  if (msg.type === 'LINK_GUIDELINE') {
    const { guidelineId, autoLoad } = msg as { guidelineId: string; autoLoad?: boolean };
    linkGuideline(guidelineId, autoLoad);
    return;
  }

  if (msg.type === 'SAVE_LOCAL_BRAND_CONFIG') {
    await saveLocalBrandConfig(msg.config);
    return;
  }

  if (msg.type === 'GET_LOCAL_BRAND_CONFIG') {
    await getLocalBrandConfig();
    return;
  }

  // ── Figma Sync ──
  if (msg.type === 'EXTRACT_FOR_SYNC') {
    try {
      const data = await extractForSync();
      postToUI({ type: 'EXTRACT_FOR_SYNC_RESULT', data });
    } catch (err) {
      postToUI({ type: 'EXTRACT_FOR_SYNC_ERROR', error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (msg.type === 'PUSH_TO_FIGMA') {
    try {
      const { guideline } = msg as any;
      const result = await pushToFigma(guideline);
      postToUI({ type: 'PUSH_TO_FIGMA_RESULT', ...result });
    } catch (err) {
      postToUI({ type: 'PUSH_TO_FIGMA_ERROR', error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Apply Brand Guidelines locally to selection ──
  if ((msg as any).type === 'APPLY_BRAND_GUIDELINES') {
    try {
      const { brand } = msg as any;
      await applyBrandGuidelinesLocally(brand);
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Create Sticky Prompt (Dev Tool) ──
  if (msg.type === 'CREATE_STICKY_PROMPT') {
    const { prompt, name } = msg as any;
    createStickyPrompt(prompt, name);
    return;
  }

  // ── Vary Selection Colors (Dev Tool) ──
  if ((msg as any).type === 'VARY_SELECTION_COLORS') {
    const brandColors = (msg as any).brandColors as string[] | undefined;
    await varySelectionColors(brandColors);
    return;
  }

  // ── Transform Selection to Slices (Dev Tool) ──
  if ((msg as any).type === 'SELECTION_TO_SLICES') {
    await selectionToSlices();
    return;
  }

  // ── Brand Linter ──
  if ((msg as any).type === 'BRAND_LINT') {
    try {
      const brand = (msg as any).brand || {};
      await lintBrandAdherence(brand);
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if ((msg as any).type === 'BRAND_LINT_FOCUS') {
    focusNode((msg as any).nodeId);
    return;
  }

  if ((msg as any).type === 'BRAND_LINT_FIX') {
    try {
      const brand = (msg as any).brand || {};
      await fixBrandIssues(brand);
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Responsive Multiplier ──
  if ((msg as any).type === 'RESPONSIVE_MULTIPLY') {
    try {
      const formats = (msg as any).formats as Array<{ id: string; label: string; width: number; height: number }> | undefined;
      await multiplyResponsive(formats);
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
};
