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
  pushToFigma
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

  if (msg.type === 'USE_SELECTION_AS_LOGO') {
    const comp = await getComponentFromSelection();
    postToUI({ type: 'SELECTION_LOGO_RESULT', component: comp });
    return;
  }

  if (msg.type === 'USE_SELECTION_AS_FONT') {
    const selection = figma.currentPage.selection;
    let fontInfo = null;
    
    if (selection.length > 0) {
      const node = selection[0];
      if (node.type === 'TEXT') {
        const font = node.fontName as FontName;
        fontInfo = {
          id: `${font.family}-${font.style}`,
          name: `${font.family} ${font.style}`,
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
};
