/// <reference types="@figma/plugin-typings" />
if (typeof performance === 'undefined') {
  (globalThis as any).performance = { now: () => Date.now() };
}
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
  multiplyResponsive,
  generateSocialFrames,
  importLogoCandidates,
  exportWithBleed,
  scanPaintStyles,
  generateBrandMatrix,
  generateLogoMatrix,
  generateVariants,
  convertToPreset,
  scanPresets,
  linearToFigma,
  fetchProjects,
  fetchMilestones,
  saveLinearConfig,
  getLinearConfig,
  scanAllSlidesForBrand,
} from './handlers/index';
import { dispatch } from './handlers/registry';
import { isEnvelope } from '@shared/protocol';

// ═══ Initialize UI ═══
figma.showUI(__html__, { width: 420, height: 680, themeColors: true, title: 'Visant Copilot' });

// Restore last window size (set by the UI resize handle)
figma.clientStorage
  .getAsync('windowSize')
  .then((size: any) => {
    if (size && size.width && size.height) {
      figma.ui.resize(size.width, size.height);
    }
  })
  .catch(() => {});

// Send current user info to UI
const currentUser = figma.currentUser;
if (currentUser) {
  postToUI({
    type: 'USER_INFO',
    user: {
      id: currentUser.id,
      name: currentUser.name,
      photoUrl: currentUser.photoUrl,
    },
  });
}

// Send the file key to the UI so it can poll the HTTP ops channel
// (external agent → POST /agent-command → Redis queue → GET /pending).
postToUI({ type: 'FILE_INFO', fileId: figma.fileKey || null });

// ═══ Selection change listener (Debounced) ═══
let selectionTimeout: number | undefined;
figma.on('selectionchange', () => {
  if (selectionTimeout) clearTimeout(selectionTimeout);
  selectionTimeout = setTimeout(notifyContextChange, 150) as any;
});

// Send current selection on plugin open
notifyContextChange();

// ═══ Message handler ═══
figma.ui.onmessage = async (msg: UIMessage) => {
  // ── New protocol (shared/protocol.ts): envelope → dispatch → result ──
  if (isEnvelope(msg as any)) {
    const result = await dispatch(msg as any);
    figma.ui.postMessage(result);
    return;
  }

  // ── Agent Operations (WebSocket from server) ──
  if (msg.type === 'AGENT_OPS') {
    try {
      const { operations, opId } = msg as any;
      await applyOperations(operations);
      postToUI({ type: 'OPERATION_ACK', opId, success: true, appliedCount: operations.length });
      console.log(`[Agent] Applied ${operations.length} operations (opId=${opId})`);
    } catch (err) {
      const { opId } = msg as any;
      postToUI({
        type: 'OPERATION_ERROR',
        opId,
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`[Agent] Operation failed (opId=${opId}):`, err);
    }
    return;
  }

  // ── File info request (UI ops-channel hook asks for the file key) ──
  if ((msg as any).type === 'GET_FILE_INFO') {
    postToUI({ type: 'FILE_INFO', fileId: figma.fileKey || null });
    return;
  }

  // ── Window resize (from UI resize handle) ──
  if (msg.type === 'RESIZE_WINDOW') {
    const width = Math.max(320, Math.round((msg as any).width));
    const height = Math.max(400, Math.round((msg as any).height));
    figma.ui.resize(width, height);
    figma.clientStorage.setAsync('windowSize', { width, height }).catch(() => {});
    return;
  }

  // ── WebSocket initialization ──
  if (msg.type === 'INIT_WS') {
    // WebSocket init acknowledged
    return;
  }

  // ── Undo last batch ──
  if (msg.type === 'UNDO_LAST_BATCH') {
    if (canUndo) {
      figma.triggerUndo();
      setCanUndo(false);
      postToUI({
        type: 'UNDO_RESULT',
        success: true,
        message: 'Última operação desfeita com sucesso.',
        canUndo: false,
      });
    } else {
      postToUI({
        type: 'UNDO_RESULT',
        success: false,
        message: 'Nenhuma operação para desfazer.',
        canUndo: false,
      });
    }
    return;
  }

  // ── Selection change notification ──
  if (msg.type === 'REPORT_SELECTION') {
    const selection = figma.currentPage.selection;
    const nodes = selection.map((n) => ({ name: n.name, id: n.id, type: n.type }));
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
      const isLogoName =
        /\b(logo|logotipo|logomarca|brand|marca|mark|emblem|badge|brasao|escudo|selo)\b/.test(
          nameLower
        );

      // Color name patterns — known color words + role words (EN + PT)
      const isColorName =
        /\b(primary|secondary|accent|neutral|surface|background|foreground|danger|warning|success|info|error|muted|destructive|primari[ao]|secundari[ao]|fundo|superficie|destaque|cor |color)\b/.test(
          nameLower
        ) ||
        /\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|vermelho|azul|verde|amarelo|laranja|roxo|rosa|preto|branco|cinza)\b/.test(
          nameLower
        );

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
        if (
          nameLower.includes('heading') ||
          nameLower.includes('title') ||
          nameLower.includes('titulo') ||
          nameLower.includes('h1') ||
          nameLower.includes('h2') ||
          nameLower.includes('h3') ||
          size >= 24
        ) {
          item.suggestedRole = 'heading';
        } else if (
          nameLower.includes('body') ||
          nameLower.includes('paragraph') ||
          nameLower.includes('corpo') ||
          nameLower.includes('texto') ||
          nameLower.includes('text')
        ) {
          item.suggestedRole = 'body';
        } else if (
          nameLower.includes('caption') ||
          nameLower.includes('label') ||
          nameLower.includes('small') ||
          nameLower.includes('legenda') ||
          nameLower.includes('rodape') ||
          size <= 12
        ) {
          item.suggestedRole = 'caption';
        } else {
          item.suggestedRole = 'body';
        }
      } else if (
        node.type === 'COMPONENT' ||
        node.type === 'COMPONENT_SET' ||
        node.type === 'INSTANCE'
      ) {
        // Component → classify by name first, then fallback to heuristics
        let comp = node;
        if (node.type === 'INSTANCE') {
          try {
            const main = await (node as InstanceNode).getMainComponentAsync();
            if (main) comp = main;
          } catch {}
        }

        // Name takes priority for classification
        const compNameLower = comp.name.toLowerCase().replace(/[-_/\\]/g, ' ');
        const isLogo =
          isLogoName ||
          /\b(logo|logotipo|brand|marca|mark|emblem)\b/.test(compNameLower) ||
          (!isButtonName &&
            !isIconName &&
            !isColorName &&
            item.width <= 400 &&
            item.height <= 400 &&
            item.width / item.height > 0.3 &&
            item.width / item.height < 3);

        // Export thumbnail for all component types
        try {
          const bytes = await (comp as SceneNode).exportAsync({
            format: 'PNG',
            constraint: { type: 'HEIGHT', value: 64 },
          });
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
      } else if (
        node.type === 'FRAME' ||
        node.type === 'GROUP' ||
        node.type === 'RECTANGLE' ||
        node.type === 'ELLIPSE'
      ) {
        const fills = 'fills' in node ? (node as any).fills : [];
        const solidFills = Array.isArray(fills)
          ? fills.filter((f: any) => f.type === 'SOLID' && f.visible !== false)
          : [];

        // Name says it's a color? Force color category even for larger shapes
        if (isColorName && solidFills.length >= 1) {
          const fill = solidFills[0];
          const r = Math.round(fill.color.r * 255);
          const g = Math.round(fill.color.g * 255);
          const b = Math.round(fill.color.b * 255);
          item.category = 'color';
          item.colorData = {
            hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
              .toString(16)
              .padStart(2, '0')}`.toUpperCase(),
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
            hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
              .toString(16)
              .padStart(2, '0')}`.toUpperCase(),
            name: node.name,
            role: guessColorRole(node.name),
          };
        } else if (isLogoName) {
          // Name says logo
          item.category = 'logo';
          try {
            const bytes = await (node as SceneNode).exportAsync({
              format: 'PNG',
              constraint: { type: 'HEIGHT', value: 64 },
            });
            item.thumbnail = `data:image/png;base64,${figma.base64Encode(bytes)}`;
          } catch {}
          item.componentData = { id: node.id, name: node.name, key: '' };
        } else {
          // Fallback: treat as potential logo
          item.category = 'logo';
          try {
            const bytes = await (node as SceneNode).exportAsync({
              format: 'PNG',
              constraint: { type: 'HEIGHT', value: 64 },
            });
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
        postToUI({
          type: 'EXPORT_NODE_IMAGE_RESULT',
          nodeId,
          error: 'Node not found or not exportable',
        });
        return;
      }
      const exportNode = node as SceneNode;
      if (format === 'SVG') {
        const bytes = await exportNode.exportAsync({ format: 'SVG' });
        const b64 = figma.base64Encode(bytes);
        postToUI({
          type: 'EXPORT_NODE_IMAGE_RESULT',
          nodeId,
          data: `data:image/svg+xml;base64,${b64}`,
          format: 'SVG',
        });
      } else {
        const bytes = await exportNode.exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 2 },
        });
        const b64 = figma.base64Encode(bytes);
        postToUI({
          type: 'EXPORT_NODE_IMAGE_RESULT',
          nodeId,
          data: `data:image/png;base64,${b64}`,
          format: 'PNG',
        });
      }
    } catch (e: any) {
      postToUI({ type: 'EXPORT_NODE_IMAGE_RESULT', nodeId, error: e.message || 'Export failed' });
    }
    return;
  }

  if (msg.type === 'OPEN_EXTERNAL_URL') {
    figma.openExternal(msg.url);
    return;
  }

  if (msg.type === 'USE_SELECTION_AS_FONT') {
    const selection = figma.currentPage.selection;
    let fontInfo = null;

    if (selection.length > 0) {
      const node = selection[0];
      if (node.type === 'TEXT') {
        const textNode = node as TextNode;
        const font = textNode.fontName as FontName;
        const fontSize = typeof textNode.fontSize !== 'symbol' ? textNode.fontSize : undefined;
        const lh = typeof textNode.lineHeight !== 'symbol' ? textNode.lineHeight : undefined;

        fontInfo = {
          id: font.family,
          name: font.family,
          family: font.family,
          style: font.style,
          fontSize,
          lineHeight: lh?.unit === 'PIXELS' ? lh.value : undefined,
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
      getFontVariablesFromFile(),
    ]);
    const selection = figma.currentPage.selection;

    postToUI({
      type: 'CONTEXT_UPDATED',
      selectedElements: selection.length,
      componentsCount: components.length,
      colorVariables: colors.length,
      fontVariables: fonts.length,
    });

    postToUI({ type: 'COMPONENTS_LOADED', components });
    postToUI({ type: 'FONT_VARIABLES_LOADED', fonts });
    postToUI({ type: 'COLOR_VARIABLES_LOADED', colors });

    // Thumbnails are exported on-demand via GET_COMPONENT_THUMBNAILS
    getAvailableFontFamilies()
      .then((families: any) => {
        postToUI({ type: 'AVAILABLE_FONTS_LOADED', families });
      })
      .catch(() => {});
    return;
  }

  // ── Lazy thumbnail export ──
  if (msg.type === 'GET_COMPONENT_THUMBNAILS') {
    const comps = msg.componentIds;
    const all = (await getComponentsInCurrentFile()) || [];
    const subset = comps ? all.filter((c) => comps.includes(c.id)) : all;
    exportComponentThumbnails(subset).catch(() => {});
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
    // Restore the page that was active when the command was sent
    if ((msg as any).pageId) {
      const targetPage = figma.root.children.find((p) => p.id === (msg as any).pageId);
      if (targetPage && targetPage !== figma.currentPage) {
        await figma.setCurrentPageAsync(targetPage);
      }
    }
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
      useScanPage ? serializePage() : serializeSelection(),
    ]);

    const availableLayers = getAvailableLayers();
    const context = {
      command: msg.command,
      sessionId: (msg as any).sessionId || '',
      fileId: figma.fileKey || 'local_file',
      pageId: figma.currentPage.id,
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
      brandGuidelineId: (msg as any).brandGuidelineId || null,
      thinkMode: (msg as any).thinkMode || false,
      useBrand: (msg as any).useBrand !== undefined ? (msg as any).useBrand : true,
      generateImage: (msg as any).generateImage || false,
      mentions: (msg as any).mentions || [],
      attachments: (msg as any).attachments || [],
    };

    postToUI({ type: 'CALL_API', context });
    return;
  }

  // ── Image paste ──
  if (msg.type === 'PASTE_GENERATED_IMAGE') {
    await pasteGeneratedImage(
      msg.imageData,
      msg.prompt,
      msg.width || 800,
      msg.height || 450,
      msg.isUrl || false
    );
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
      postToUI({
        type: 'EXTRACT_FOR_SYNC_ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (msg.type === 'PUSH_TO_FIGMA') {
    try {
      const { guideline } = msg as any;
      const result = await pushToFigma(guideline);
      postToUI({ type: 'PUSH_TO_FIGMA_RESULT', ...result });
    } catch (err) {
      postToUI({
        type: 'PUSH_TO_FIGMA_ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  // ── Scan Hardcoded Colors → Variable Matches ──
  if ((msg as any).type === 'SCAN_HARDCODED_COLORS') {
    try {
      const threshold = (msg as any).threshold ?? 0.15;
      const sel = figma.currentPage.selection;
      if (sel.length === 0) {
        postToUI({ type: 'COLOR_SCAN_RESULTS', matches: [] });
        return;
      }

      const allVars = figma.variables ? await figma.variables.getLocalVariablesAsync('COLOR') : [];
      const palette: {
        variable: Variable;
        rgb: { r: number; g: number; b: number };
        hex: string;
        name: string;
      }[] = [];

      for (const v of allVars) {
        const modeId = Object.keys(v.valuesByMode)[0];
        const val = v.valuesByMode[modeId];
        if (typeof val === 'object' && val !== null && 'r' in val) {
          const rgb = val as { r: number; g: number; b: number };
          const hex =
            '#' +
            [rgb.r, rgb.g, rgb.b]
              .map((c) =>
                Math.round(c * 255)
                  .toString(16)
                  .padStart(2, '0')
              )
              .join('')
              .toUpperCase();
          palette.push({ variable: v, rgb, hex, name: v.name });
        }
      }

      // Also include local paint styles
      const paintStyles = await figma.getLocalPaintStylesAsync();
      for (const style of paintStyles) {
        const paint = style.paints[0];
        if (paint?.type === 'SOLID' && paint.color) {
          const rgb = paint.color;
          const hex =
            '#' +
            [rgb.r, rgb.g, rgb.b]
              .map((c) =>
                Math.round(c * 255)
                  .toString(16)
                  .padStart(2, '0')
              )
              .join('')
              .toUpperCase();
          const alreadyExists = palette.some((p) => p.hex === hex);
          if (!alreadyExists) {
            palette.push({ variable: null as any, rgb, hex, name: style.name });
          }
        }
      }

      if (palette.length === 0) {
        postToUI({ type: 'COLOR_SCAN_RESULTS', matches: [] });
        return;
      }

      const matches: any[] = [];
      const colorDist = (
        a: { r: number; g: number; b: number },
        b: { r: number; g: number; b: number }
      ) => Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

      function scanNode(node: SceneNode) {
        if ('fills' in node) {
          const fills = (node as GeometryMixin).fills as Paint[];
          if (Array.isArray(fills)) {
            for (let i = 0; i < fills.length; i++) {
              const fill = fills[i];
              if (fill.type !== 'SOLID' || fill.visible === false) continue;
              if ((fill as any).boundVariables?.color) continue;
              const { r, g, b } = (fill as SolidPaint).color;
              let bestDist = Infinity;
              let bestMatch: (typeof palette)[0] | null = null;
              for (const p of palette) {
                const dist = colorDist({ r, g, b }, p.rgb);
                if (dist < bestDist) {
                  bestDist = dist;
                  bestMatch = p;
                }
              }
              if (bestMatch && bestDist <= threshold) {
                const hex =
                  '#' +
                  [r, g, b]
                    .map((c) =>
                      Math.round(c * 255)
                        .toString(16)
                        .padStart(2, '0')
                    )
                    .join('')
                    .toUpperCase();
                matches.push({
                  nodeId: node.id,
                  nodeName: node.name,
                  property: 'fill',
                  index: i,
                  currentHex: hex,
                  matchedVariableName: bestMatch.name,
                  matchedVariableId: bestMatch.variable?.id ?? '',
                  matchedHex: bestMatch.hex,
                  distance: bestDist,
                });
              }
            }
          }
        }
        if ('strokes' in node) {
          const strokes = (node as GeometryMixin).strokes as Paint[];
          if (Array.isArray(strokes)) {
            for (let i = 0; i < strokes.length; i++) {
              const stroke = strokes[i];
              if (stroke.type !== 'SOLID' || stroke.visible === false) continue;
              if ((stroke as any).boundVariables?.color) continue;
              const { r, g, b } = (stroke as SolidPaint).color;
              let bestDist = Infinity;
              let bestMatch: (typeof palette)[0] | null = null;
              for (const p of palette) {
                const dist = colorDist({ r, g, b }, p.rgb);
                if (dist < bestDist) {
                  bestDist = dist;
                  bestMatch = p;
                }
              }
              if (bestMatch && bestDist <= threshold) {
                const hex =
                  '#' +
                  [r, g, b]
                    .map((c) =>
                      Math.round(c * 255)
                        .toString(16)
                        .padStart(2, '0')
                    )
                    .join('')
                    .toUpperCase();
                matches.push({
                  nodeId: node.id,
                  nodeName: node.name,
                  property: 'stroke',
                  index: i,
                  currentHex: hex,
                  matchedVariableName: bestMatch.name,
                  matchedVariableId: bestMatch.variable?.id ?? '',
                  matchedHex: bestMatch.hex,
                  distance: bestDist,
                });
              }
            }
          }
        }
        if ('children' in node) {
          for (const child of (node as any).children) scanNode(child as SceneNode);
        }
      }

      for (const node of sel) scanNode(node);

      // Deduplicate by unique color pair
      const seen = new Set<string>();
      const deduped = matches.filter((m) => {
        const key = `${m.currentHex}:${m.matchedVariableId}`;
        if (seen.has(key)) {
          // Keep all but show count later
        }
        return true; // keep all for apply
      });

      postToUI({
        type: 'COLOR_SCAN_RESULTS',
        matches: deduped.filter((m: any) => m.matchedVariableId),
      });
    } catch (err) {
      postToUI({
        type: 'ERROR',
        message: `Scan error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    return;
  }

  // ── Apply Color Bindings (from scan results) ──
  if ((msg as any).type === 'APPLY_COLOR_BINDINGS') {
    try {
      const bindings = (msg as any).bindings as Array<{
        nodeId: string;
        property: 'fill' | 'stroke';
        index: number;
        variableId: string;
      }>;
      let applied = 0;
      for (const b of bindings) {
        if (!b.variableId) continue;
        const node = await figma.getNodeByIdAsync(b.nodeId);
        if (!node) continue;
        const variable = await figma.variables.getVariableByIdAsync(b.variableId);
        if (!variable) continue;
        const prop = b.property === 'stroke' ? 'strokes' : 'fills';
        if (!(prop in node)) continue;
        const paints = [...((node as any)[prop] as Paint[])];
        const paint = paints[b.index];
        if (!paint || paint.type !== 'SOLID') continue;
        paints[b.index] = figma.variables.setBoundVariableForPaint(
          paint as SolidPaint,
          'color',
          variable
        );
        (node as any)[prop] = paints;
        applied++;
      }
      postToUI({ type: 'OPERATIONS_DONE' });
      figma.notify(`✓ Bound ${applied} colors to variables`);
    } catch (err) {
      postToUI({
        type: 'ERROR',
        message: `Apply error: ${err instanceof Error ? err.message : String(err)}`,
      });
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
    postToUI({ type: 'OPERATIONS_DONE' });
    return;
  }

  // ── Transform Selection to Slices (Dev Tool) ──
  if ((msg as any).type === 'SELECTION_TO_SLICES') {
    await selectionToSlices();
    postToUI({ type: 'OPERATIONS_DONE' });
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

  if ((msg as any).type === 'BRAND_LINT_FOCUS' || (msg as any).type === 'FOCUS_NODE') {
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

  // ── Scan all slides/pages for brand analysis ──
  if ((msg as any).type === 'SCAN_SLIDES_FOR_BRAND') {
    try {
      await scanAllSlidesForBrand((msg as any).maxWidth ?? 800);
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Import Logo Candidates from library ──
  if ((msg as any).type === 'IMPORT_LOGO_CANDIDATES') {
    try {
      await importLogoCandidates((msg as any).maxWidth);
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Social Brand Frames ──
  if ((msg as any).type === 'GENERATE_SOCIAL_FRAMES') {
    try {
      const brandColors = (msg as any).brandColors || [];
      await generateSocialFrames(brandColors);
      postToUI({ type: 'OPERATIONS_DONE' });
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Variant Generator ──
  if ((msg as any).type === 'GENERATE_VARIANTS') {
    try {
      const presets = (msg as any).presets;
      await generateVariants(presets);
      postToUI({ type: 'OPERATIONS_DONE' });
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Convert to Preset ──
  if ((msg as any).type === 'CONVERT_TO_PRESET') {
    try {
      const result = await convertToPreset({
        format: (msg as any).format,
        variant: (msg as any).variant,
      });
      postToUI({ type: 'PRESET_CREATED', ...result });
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Linear Bridge: scan presets ──
  if ((msg as any).type === 'SCAN_PRESETS') {
    try {
      const presets = scanPresets();
      postToUI({ type: 'PRESETS_SCANNED', presets });
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Linear Bridge: fetch projects ──
  if ((msg as any).type === 'FETCH_LINEAR_PROJECTS') {
    try {
      const projects = await fetchProjects((msg as any).linearApiKey);
      postToUI({ type: 'LINEAR_PROJECTS', projects });
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Linear Bridge: fetch milestones ──
  if ((msg as any).type === 'FETCH_LINEAR_MILESTONES') {
    try {
      const milestones = await fetchMilestones((msg as any).linearApiKey, (msg as any).projectId);
      postToUI({ type: 'LINEAR_MILESTONES', milestones });
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Linear Bridge: full pipeline ──
  if ((msg as any).type === 'LINEAR_TO_FIGMA') {
    try {
      const result = await linearToFigma({
        linearApiKey: (msg as any).linearApiKey,
        projectId: (msg as any).projectId,
        strategy: (msg as any).strategy || 'random',
        formats: (msg as any).formats || ['Story'],
        filterIssues: (msg as any).filterIssues,
        milestoneId: (msg as any).milestoneId,
        dryRun: (msg as any).dryRun,
      });
      postToUI({ type: 'BRIDGE_DONE', ...result });
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Linear Bridge: save/load config ──
  if ((msg as any).type === 'SAVE_LINEAR_CONFIG') {
    await saveLinearConfig({ apiKey: (msg as any).apiKey, projectId: (msg as any).projectId });
    postToUI({ type: 'LINEAR_CONFIG_SAVED' });
    return;
  }
  if ((msg as any).type === 'GET_LINEAR_CONFIG') {
    const config = await getLinearConfig();
    postToUI({ type: 'LINEAR_CONFIG_LOADED', ...config });
    return;
  }

  // ── Responsive Multiplier ──
  if ((msg as any).type === 'RESPONSIVE_MULTIPLY') {
    try {
      const formats = (msg as any).formats as
        | Array<{ id: string; label: string; width: number; height: number }>
        | undefined;
      await multiplyResponsive(formats);
      postToUI({ type: 'OPERATIONS_DONE' });
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Illustrator Exporter (PNG + SVG) ──
  if ((msg as any).type === 'ILLUSTRATOR_EXPORT') {
    const selection = figma.currentPage.selection;
    const frames = selection.filter((n) => n.type === 'FRAME') as FrameNode[];
    if (frames.length === 0) {
      figma.notify('Selecione um Frame.');
      return;
    }

    const batch: any[] = [];

    for (const node of frames) {
      try {
        const uniqueName = node.name.replace(/[\/\\?%*:|"<>]/g, '-');

        // 1 & 2: VECTORS (SVG) - Clone 1: hide images, keep vectors and text
        const vectorClone = node.clone();
        const hideImages = (n: SceneNode) => {
          const hasImage =
            'fills' in n && Array.isArray(n.fills) && n.fills.some((f: any) => f.type === 'IMAGE');
          if (hasImage) {
            n.visible = false;
          }
          if ('children' in n) {
            for (const child of n.children) hideImages(child);
          }
        };
        hideImages(vectorClone);
        // Export SVG
        const svgBytes = await vectorClone.exportAsync({ format: 'SVG' });

        // 3: RASTERS (PNG) - Clone 2: hide vectors, keep only images
        const rasterClone = node.clone();
        const hideVectors = (n: SceneNode) => {
          const hasImage =
            'fills' in n && Array.isArray(n.fills) && n.fills.some((f: any) => f.type === 'IMAGE');
          if (!hasImage && !('children' in n)) {
            // Hide pure vectors/text
            n.visible = false;
          } else if (!hasImage && 'children' in n && n.children.length === 0) {
            n.visible = false;
          }
          if ('children' in n) for (const child of n.children) hideVectors(child);
        };
        hideVectors(rasterClone);
        // Export PNG at 3x
        const pngBytes = await rasterClone.exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 3 },
        });

        // 5: Delete clones
        vectorClone.remove();
        rasterClone.remove();

        // 4: Output 2 files
        batch.push({
          name: uniqueName,
          png: pngBytes,
          svg: svgBytes,
        });
      } catch (e: any) {
        figma.notify('Erro no export: ' + e.message);
      }
    }

    postToUI({
      type: 'ILLUSTRATOR_EXPORT_BATCH',
      items: batch,
      count: batch.length,
    });
    return;
  }

  if (msg.type === 'COPY_ILLUSTRATOR_CODE') {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify('Selecione algo.');
      return;
    }
    const node = selection[0];
    const width = 'width' in node ? node.width : 800;
    const height = 'height' in node ? node.height : 600;

    let script = `// Visant AI - Quick Illustrator Copy (Vectors Only)\n`;
    script += `var doc = app.documents.add(DocumentColorSpace.RGB, ${width}, ${height});\n\n`;

    const process = (n: SceneNode) => {
      let code = '';
      const x = n.x,
        y = n.y,
        w = 'width' in n ? n.width : 0,
        h = 'height' in n ? n.height : 0,
        top = height - y;
      if (n.type === 'RECTANGLE' || n.type === 'ELLIPSE' || n.type === 'TEXT') {
        code += `(function(){\n`;
        if (n.type === 'RECTANGLE')
          code += `  var item = doc.pathItems.rectangle(${top}, ${x}, ${w}, ${h});\n`;
        else if (n.type === 'ELLIPSE')
          code += `  var item = doc.pathItems.ellipse(${top}, ${x}, ${w}, ${h});\n`;
        else if (n.type === 'TEXT') {
          code += `  var item = doc.textFrames.add(); item.contents = "${n.characters
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')}";\n`;
          code += `  item.top = ${top}; item.left = ${x};\n`;
          if ('fontSize' in n && typeof n.fontSize === 'number')
            code += `  item.textRange.characterAttributes.size = ${n.fontSize};\n`;
        }
        if ('fills' in n && (n.fills as any).length > 0 && (n.fills as any)[0].type === 'SOLID') {
          const c = (n.fills as any)[0].color;
          code += `  var c = new RGBColor(); c.red=${Math.round(c.r * 255)}; c.green=${Math.round(
            c.g * 255
          )}; c.blue=${Math.round(c.b * 255)}; item.fillColor = c; item.filled = true;\n`;
        }
        code += `})();\n\n`;
      }
      if ('children' in n) for (const child of n.children) code += process(child);
      return code;
    };
    script += process(node);
    postToUI({ type: 'ILLUSTRATOR_CODE_READY', code: script });
    return;
  }

  // ── Export with Bleed (Arte Final) ──
  if ((msg as any).type === 'EXPORT_WITH_BLEED') {
    try {
      await exportWithBleed();
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Brand Matrix: Scan Paint Styles ──
  if ((msg as any).type === 'SCAN_PAINT_STYLES') {
    try {
      const tokens = await scanPaintStyles();
      postToUI({ type: 'PAINT_STYLES_RESULT', tokens });
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Brand Matrix: Generate Assets ──
  if ((msg as any).type === 'GENERATE_ASSETS') {
    try {
      const { colors, assets } = msg as any;
      await generateBrandMatrix({ colors, assets });
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  // ── Logo Matrix: Simple clone + recolor ──
  if ((msg as any).type === 'LOGO_MATRIX') {
    try {
      const { colors } = msg as any;
      await generateLogoMatrix({ colors });
    } catch (err) {
      postToUI({ type: 'ERROR', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (msg.type === 'GET_SELECTION_FILL') {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.notify('Select an object with a solid fill.');
      return;
    }
    const node = selection[0];
    if ('fills' in node && Array.isArray(node.fills)) {
      const solidFill = node.fills.find((f) => f.type === 'SOLID' && f.visible !== false);
      if (solidFill) {
        const r = Math.round(solidFill.color.r * 255);
        const g = Math.round(solidFill.color.g * 255);
        const b = Math.round(solidFill.color.b * 255);
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
          .toString(16)
          .padStart(2, '0')}`.toUpperCase();
        postToUI({ type: 'SELECTION_FILL_RESULT', hex, name: node.name });
      } else {
        figma.notify('No solid fill found on selection.');
      }
    } else {
      figma.notify('Selected object does not support fills.');
    }
    return;
  }
};
