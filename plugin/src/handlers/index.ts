/// <reference types="@figma/plugin-typings" />

export { applyOperations } from './operations';
export {
  getComponentsInCurrentFile,
  exportComponentThumbnails,
  getComponentFromSelection,
  getAgentComponents,
  getFolderPath,
  exportThumbnail
} from './components';
export {
  getColorVariablesFromFile,
  getFontVariablesFromFile,
  getAvailableFontFamilies
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
  getLocalBrandConfig
} from './storage';
export { extractForSync, pushToFigma } from './figmaSync';
export { applyBrandGuidelinesLocally } from './brandApply';
export { createStickyPrompt, varySelectionColors, selectionToSlices } from './devTools';
export { lintBrandAdherence, focusNode, fixBrandIssues } from './brandLint';
export { multiplyResponsive, DEFAULT_FORMATS } from './responsiveMultiply';
export { generateBrandGrid } from './brandGrid';
export { generateSocialFrames } from './socialFrames';
export { importLogoCandidates } from './brandImport';
