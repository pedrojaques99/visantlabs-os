/**
 * usePluginMessages - Unified pattern for all plugin message requests
 *
 * Pattern: Component calls sendMessage() → Sandbox processes → Response comes back → Handler updates state
 *
 * All vanilla JS features reimplemented with this pattern
 */

import { useCallback } from 'react';
import { useFigmaMessages } from './useFigmaMessages';
import { usePluginStore } from '../store';
import type { UIMessage } from '@/lib/figma-types';

export function usePluginMessages() {
  const { send } = useFigmaMessages();
  const store = usePluginStore();

  // ═══ Context & Selection ═══

  const getContext = useCallback(() => {
    send({ type: 'GET_CONTEXT' } as UIMessage);
  }, [send]);

  const getEnrichedContext = useCallback(() => {
    send({ type: 'GET_ENRICHED_CONTEXT' } as UIMessage);
  }, [send]);

  const reportSelection = useCallback(() => {
    send({ type: 'REPORT_SELECTION' } as UIMessage);
  }, [send]);

  // ═══ Smart Scan & Analysis ═══

  const smartScanSelection = useCallback(() => {
    send({ type: 'SMART_SCAN_SELECTION' } as UIMessage);
  }, [send]);

  // ═══ Operations & Design ═══

  const applyOperations = useCallback((operations: any[]) => {
    send({
      type: 'APPLY_OPERATIONS',
      payload: operations
    } as UIMessage);
  }, [send]);

  const applyOperationsFromAPI = useCallback((operations: any[]) => {
    send({
      type: 'APPLY_OPERATIONS_FROM_API',
      operations
    } as UIMessage);
  }, [send]);

  const deleteSelection = useCallback(() => {
    send({ type: 'DELETE_SELECTION' } as UIMessage);
  }, [send]);

  const undoLastBatch = useCallback(() => {
    send({ type: 'UNDO_LAST_BATCH' } as UIMessage);
  }, [send]);

  // ═══ Selection & Export ═══

  const useSelectionAsLogo = useCallback(() => {
    send({ type: 'USE_SELECTION_AS_LOGO' } as UIMessage);
  }, [send]);

  const useSelectionAsFont = useCallback(() => {
    send({ type: 'USE_SELECTION_AS_FONT' } as UIMessage);
  }, [send]);

  const captureComponentSelection = useCallback(() => {
    send({ type: 'CAPTURE_COMPONENT_SELECTION' } as UIMessage);
  }, [send]);

  const exportNodeImage = useCallback((nodeId: string, format: 'SVG' | 'PNG' = 'PNG') => {
    send({
      type: 'EXPORT_NODE_IMAGE',
      nodeId,
      format
    } as UIMessage);
  }, [send]);

  const pasteGeneratedImage = useCallback((imageData: string, prompt: string, width?: number, height?: number, isUrl?: boolean) => {
    send({
      type: 'PASTE_GENERATED_IMAGE',
      imageData,
      prompt,
      width,
      height,
      isUrl
    } as UIMessage);
  }, [send]);

  // ═══ Elements & Library ═══

  const getElementsForMentions = useCallback(() => {
    send({ type: 'GET_ELEMENTS_FOR_MENTIONS' } as UIMessage);
  }, [send]);

  const getTemplates = useCallback((requestId: string) => {
    send({
      type: 'GET_TEMPLATES',
      requestId
    } as UIMessage);
  }, [send]);

  const getAgentComponents = useCallback(() => {
    send({ type: 'GET_AGENT_COMPONENTS' } as UIMessage);
  }, [send]);

  // ═══ Scaffolding & Library ═══

  const scaffoldAgentLibrary = useCallback((brand: any) => {
    send({
      type: 'SCAFFOLD_AGENT_LIBRARY',
      brand
    } as UIMessage);
  }, [send]);

  // ═══ Navigation & UI ═══

  const selectAndZoom = useCallback((nodeId: string) => {
    send({
      type: 'SELECT_AND_ZOOM',
      nodeId
    } as UIMessage);
  }, [send]);

  const openExternal = useCallback((url: string) => {
    send({
      type: 'OPEN_EXTERNAL',
      url
    } as UIMessage);
  }, [send]);

  // ═══ Auth & Keys ═══

  const saveApiKey = useCallback((key: string) => {
    send({
      type: 'SAVE_API_KEY',
      key
    } as UIMessage);
  }, [send]);

  const getApiKey = useCallback(() => {
    send({ type: 'GET_API_KEY' } as UIMessage);
  }, [send]);

  const saveAnthropicKey = useCallback((key: string) => {
    send({
      type: 'SAVE_ANTHROPIC_KEY',
      key
    } as UIMessage);
  }, [send]);

  const getAnthropicKey = useCallback(() => {
    send({ type: 'GET_ANTHROPIC_KEY' } as UIMessage);
  }, [send]);

  const saveAuthToken = useCallback((token: string) => {
    send({
      type: 'SAVE_AUTH_TOKEN',
      token
    } as UIMessage);
  }, [send]);

  const getAuthToken = useCallback(() => {
    send({ type: 'GET_AUTH_TOKEN' } as UIMessage);
  }, [send]);

  // ═══ Guidelines ═══

  const getGuidelines = useCallback(() => {
    send({ type: 'GET_GUIDELINES' } as UIMessage);
  }, [send]);

  const saveGuideline = useCallback((guideline: any) => {
    send({
      type: 'SAVE_GUIDELINE',
      guideline
    } as UIMessage);
  }, [send]);

  const deleteGuideline = useCallback((id: string) => {
    send({
      type: 'DELETE_GUIDELINE',
      id
    } as UIMessage);
  }, [send]);

  // ═══ Design System ═══

  const getDesignSystem = useCallback(() => {
    send({ type: 'GET_DESIGN_SYSTEM' } as UIMessage);
  }, [send]);

  const saveDesignSystem = useCallback((designSystem: any) => {
    send({
      type: 'SAVE_DESIGN_SYSTEM',
      designSystem
    } as UIMessage);
  }, [send]);

  // ═══ Brand Guidelines ═══

  const getBrandGuideline = useCallback(() => {
    send({ type: 'GET_BRAND_GUIDELINE' } as UIMessage);
  }, [send]);

  const saveBrandGuideline = useCallback((selectedId: string, guideline: any) => {
    send({
      type: 'SAVE_BRAND_GUIDELINE',
      selectedId,
      guideline
    } as UIMessage);
  }, [send]);

  const linkGuideline = useCallback((guidelineId: string, autoLoad?: boolean) => {
    send({
      type: 'LINK_GUIDELINE',
      guidelineId,
      autoLoad
    } as UIMessage);
  }, [send]);

  const saveLocalBrandConfig = useCallback((config: any) => {
    send({
      type: 'SAVE_LOCAL_BRAND_CONFIG',
      config
    } as UIMessage);
  }, [send]);

  const getLocalBrandConfig = useCallback(() => {
    send({ type: 'GET_LOCAL_BRAND_CONFIG' } as UIMessage);
  }, [send]);

  // ═══ Sync & Figma ═══

  const extractForSync = useCallback(() => {
    send({ type: 'EXTRACT_FOR_SYNC' } as UIMessage);
  }, [send]);

  const pushToFigma = useCallback((guideline: any) => {
    send({
      type: 'PUSH_TO_FIGMA',
      guideline
    } as UIMessage);
  }, [send]);

  // ═══ Brand Intelligence & Operations ═══

  const applyBrandGuidelines = useCallback((brand: any) => {
    send({
      type: 'APPLY_BRAND_GUIDELINES',
      brand
    } as UIMessage);
  }, [send]);

  const createStickyPrompt = useCallback((prompt: string, name: string) => {
    send({
      type: 'CREATE_STICKY_PROMPT',
      prompt,
      name
    } as UIMessage);
  }, [send]);

  const varySelectionColors = useCallback((brandColors?: string[]) => {
    send({
      type: 'VARY_SELECTION_COLORS',
      brandColors
    } as UIMessage);
  }, [send]);

  const selectionToSlices = useCallback(() => {
    send({ type: 'SELECTION_TO_SLICES' } as UIMessage);
  }, [send]);

  const brandLint = useCallback((brand?: any) => {
    send({
      type: 'BRAND_LINT',
      brand
    } as UIMessage);
  }, [send]);

  const brandLintFocus = useCallback((nodeId: string) => {
    send({
      type: 'BRAND_LINT_FOCUS',
      nodeId
    } as UIMessage);
  }, [send]);

  const fixBrandIssues = useCallback((brand?: any) => {
    send({
      type: 'BRAND_LINT_FIX',
      brand
    } as UIMessage);
  }, [send]);

  const responsiveMultiply = useCallback((formats?: Array<{ id: string; label: string; width: number; height: number }>) => {
    send({
      type: 'RESPONSIVE_MULTIPLY',
      formats
    } as UIMessage);
  }, [send]);

  // ═══ Export & Advanced ═══

  const illustratorExport = useCallback(() => {
    send({ type: 'ILLUSTRATOR_EXPORT' } as UIMessage);
  }, [send]);

  const copyIllustratorCode = useCallback(() => {
    send({ type: 'COPY_ILLUSTRATOR_CODE' } as UIMessage);
  }, [send]);

  return {
    // Context & Selection
    getContext,
    getEnrichedContext,
    reportSelection,

    // Smart Scan
    smartScanSelection,

    // Operations
    applyOperations,
    applyOperationsFromAPI,
    deleteSelection,
    undoLastBatch,

    // Selection & Export
    useSelectionAsLogo,
    useSelectionAsFont,
    captureComponentSelection,
    exportNodeImage,
    pasteGeneratedImage,

    // Elements & Library
    getElementsForMentions,
    getTemplates,
    getAgentComponents,
    scaffoldAgentLibrary,

    // Navigation
    selectAndZoom,
    openExternal,

    // Auth & Keys
    saveApiKey,
    getApiKey,
    saveAnthropicKey,
    getAnthropicKey,
    saveAuthToken,
    getAuthToken,

    // Guidelines
    getGuidelines,
    saveGuideline,
    deleteGuideline,

    // Design System
    getDesignSystem,
    saveDesignSystem,

    // Brand Guidelines
    getBrandGuideline,
    saveBrandGuideline,
    linkGuideline,
    saveLocalBrandConfig,
    getLocalBrandConfig,

    // Sync
    extractForSync,
    pushToFigma,

    // Brand Intelligence
    applyBrandGuidelines,
    createStickyPrompt,
    varySelectionColors,
    selectionToSlices,
    brandLint,
    brandLintFocus,
    fixBrandIssues,
    responsiveMultiply,

    // Export
    illustratorExport,
    copyIllustratorCode
  };
}
