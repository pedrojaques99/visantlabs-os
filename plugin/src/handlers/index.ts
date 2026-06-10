/// <reference types="@figma/plugin-typings" />

export { applyOperations } from './operations';
export {
  getComponentsInCurrentFile,
  exportComponentThumbnails,
  getComponentFromSelection,
  getAgentComponents,
  getFolderPath,
  exportThumbnail,
} from './components';
export {
  getColorVariablesFromFile,
  getFontVariablesFromFile,
  getAvailableFontFamilies,
} from './variables';
export { notifyContextChange } from './context';
export { getTemplates } from './templates';
export { scaffoldAgentLibrary } from './scaffold';
export { pasteGeneratedImage, deleteSelection } from './image';
export {
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
} from './storage';
export { extractForSync, pushToFigma } from './figmaSync';
export { applyBrandGuidelinesLocally } from './brandApply';
export { createStickyPrompt, varySelectionColors, selectionToSlices } from './devTools';
export { lintBrandAdherence, focusNode, fixBrandIssues } from './brandLint';
export { multiplyResponsive, DEFAULT_FORMATS } from './responsiveMultiply';
export { scanPaintStyles, generateBrandMatrix, generateLogoMatrix } from './brandMatrix';
export { generateSocialFrames } from './socialFrames';
export { importLogoCandidates } from './brandImport';
export { exportWithBleed } from './exportBleed';
export { exportTextToMarkdown } from './exportText';
export { scanFontsInSelection, scanFontsInPage, swapFonts, getStylesForFamily } from './text';
export { generateVariants, DEFAULT_PRESETS } from './variantGenerator';
export { convertToPreset } from './convertToPreset';
export {
  scanPresets,
  linearToFigma,
  fetchProjects,
  fetchMilestones,
  saveLinearConfig,
  getLinearConfig,
} from './linearBridge';
export { scanColorsForRename, applyColorRename } from './colorRename';
