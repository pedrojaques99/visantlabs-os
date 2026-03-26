/// <reference types="@figma/plugin-typings" />

import { postToUI } from '../utils/postMessage';

// ═══ API KEYS ═══

export async function saveApiKey(key: string) {
  try {
    await figma.clientStorage.setAsync('userApiKey', key);
    postToUI({ type: 'API_KEY_SAVED' });
  } catch {
    postToUI({ type: 'API_KEY_SAVED' });
  }
}

export async function getApiKey() {
  try {
    const key = await figma.clientStorage.getAsync('userApiKey');
    postToUI({ type: 'API_KEY_LOADED', key: key || '' });
  } catch {
    postToUI({ type: 'API_KEY_LOADED', key: '' });
  }
}

export async function saveAnthropicKey(key: string) {
  try {
    await figma.clientStorage.setAsync('anthropicApiKey', key);
    postToUI({ type: 'ANTHROPIC_KEY_SAVED' });
  } catch {
    postToUI({ type: 'ANTHROPIC_KEY_SAVED' });
  }
}

export async function getAnthropicKey() {
  try {
    const key = await figma.clientStorage.getAsync('anthropicApiKey');
    postToUI({ type: 'ANTHROPIC_KEY_LOADED', key: key || '' });
  } catch {
    postToUI({ type: 'ANTHROPIC_KEY_LOADED', key: '' });
  }
}

// ═══ AUTH TOKEN ═══

export async function saveAuthToken(token: string) {
  try {
    await figma.clientStorage.setAsync('authToken', token || '');
    postToUI({ type: 'AUTH_TOKEN_SAVED' });
  } catch {
    postToUI({ type: 'AUTH_TOKEN_SAVED' });
  }
}

export async function getAuthToken() {
  try {
    const token = await figma.clientStorage.getAsync('authToken');
    postToUI({ type: 'AUTH_TOKEN_LOADED', token: token || '' });
  } catch {
    postToUI({ type: 'AUTH_TOKEN_LOADED', token: '' });
  }
}

// ═══ BRAND GUIDELINES ═══

export function getGuidelines() {
  try {
    const raw = figma.root.getPluginData('brandGuidelines');
    const guidelines = raw ? JSON.parse(raw) : [];
    postToUI({ type: 'GUIDELINES_LOADED', guidelines });
  } catch {
    postToUI({ type: 'GUIDELINES_LOADED', guidelines: [] });
  }
}

export function saveGuideline(guideline: any) {
  try {
    const raw = figma.root.getPluginData('brandGuidelines');
    const guidelines: unknown[] = raw ? JSON.parse(raw) : [];
    const idx = guidelines.findIndex((g: any) => g.id === guideline.id);
    if (idx >= 0) guidelines[idx] = guideline;
    else guidelines.push(guideline);
    figma.root.setPluginData('brandGuidelines', JSON.stringify(guidelines));
    postToUI({ type: 'GUIDELINE_SAVED', guidelines, savedId: guideline.id });
  } catch {
    postToUI({ type: 'GUIDELINE_SAVED', guidelines: [guideline], savedId: guideline.id });
  }
}

export function deleteGuideline(id: string) {
  try {
    const raw = figma.root.getPluginData('brandGuidelines');
    const guidelines: unknown[] = raw ? JSON.parse(raw) : [];
    const updated = guidelines.filter((g: any) => g.id !== id);
    figma.root.setPluginData('brandGuidelines', JSON.stringify(updated));
    postToUI({ type: 'GUIDELINES_LOADED', guidelines: updated });
  } catch {
    postToUI({ type: 'GUIDELINES_LOADED', guidelines: [] });
  }
}

// ═══ DESIGN SYSTEM ═══

export function getDesignSystem() {
  try {
    const raw = figma.root.getPluginData('visantDesignSystem');
    const designSystem = raw ? JSON.parse(raw) : null;
    postToUI({ type: 'DESIGN_SYSTEM_LOADED', designSystem });
  } catch {
    postToUI({ type: 'DESIGN_SYSTEM_LOADED', designSystem: null });
  }
}

export function saveDesignSystem(designSystem: any) {
  try {
    if (designSystem) {
      figma.root.setPluginData('visantDesignSystem', JSON.stringify(designSystem));
    } else {
      figma.root.setPluginData('visantDesignSystem', '');
    }
    postToUI({ type: 'DESIGN_SYSTEM_SAVED', designSystem });
  } catch {
    postToUI({ type: 'DESIGN_SYSTEM_SAVED', designSystem: null });
  }
}

// ═══ BRAND GUIDELINE (Single selection) ═══

export function getBrandGuideline() {
  try {
    const selectedId = figma.root.getPluginData('brandGuidelineSelectedId');
    const cached = figma.root.getPluginData('brandGuidelineCache');
    postToUI({
      type: 'BRAND_GUIDELINE_LOADED',
      selectedId: selectedId || null,
      guideline: cached || null,
    });
  } catch (e) {
    postToUI({
      type: 'BRAND_GUIDELINE_LOADED',
      selectedId: null,
      guideline: null,
    });
  }
}

export function saveBrandGuideline(selectedId: string | null, guideline: string | null) {
  try {
    figma.root.setPluginData('brandGuidelineSelectedId', selectedId || '');
    figma.root.setPluginData('brandGuidelineCache', guideline || '');
    postToUI({ type: 'BRAND_GUIDELINE_SAVED' });
  } catch (e) {
    postToUI({ type: 'BRAND_GUIDELINE_SAVED' });
  }
}

export function linkGuideline(guidelineId: string, autoLoad?: boolean) {
  try {
    if (guidelineId) {
      figma.root.setPluginData('brandGuidelineSelectedId', guidelineId);
      postToUI({
        type: 'BRAND_GUIDELINE_LOADED',
        selectedId: guidelineId,
        guideline: null,
        autoLoad: autoLoad ?? true,
      });
    }
  } catch (e) {
    // Ignore error
  }
}

// ═══ LOCAL BRAND CONFIG (Ad-hoc properties) ═══
// Hybrid storage: clientStorage (persists locally without saving file) + pluginData (persists in file)

function getFileStorageKey(): string {
  // Use fileKey to scope storage per file
  const fileKey = figma.fileKey || figma.root.id;
  return `brandConfig:${fileKey}`;
}

export async function saveLocalBrandConfig(config: any) {
  try {
    const configStr = JSON.stringify(config);
    const storageKey = getFileStorageKey();

    // Save to both storage mechanisms for redundancy
    // 1. clientStorage - persists locally even without saving file
    await figma.clientStorage.setAsync(storageKey, configStr);

    // 2. pluginData - persists in file when saved (for cross-device sync)
    figma.root.setPluginData('localBrandConfig', configStr);

    postToUI({ type: 'LOCAL_BRAND_SAVED' });
  } catch (e) {
    console.warn('[Plugin] Error saving local brand config:', e);
  }
}

export async function getLocalBrandConfig() {
  try {
    const storageKey = getFileStorageKey();

    // Try clientStorage first (most recent local state)
    let config = null;
    const clientData = await figma.clientStorage.getAsync(storageKey);
    if (clientData) {
      config = JSON.parse(clientData);
    }

    // Fallback to pluginData (for cross-device sync or older data)
    if (!config) {
      const pluginData = figma.root.getPluginData('localBrandConfig');
      if (pluginData) {
        config = JSON.parse(pluginData);
        // Sync to clientStorage for consistency
        await figma.clientStorage.setAsync(storageKey, pluginData);
      }
    }

    postToUI({ type: 'LOCAL_BRAND_LOADED', config });
  } catch (e) {
    console.warn('[Plugin] Error loading local brand config:', e);
    postToUI({ type: 'LOCAL_BRAND_LOADED', config: null });
  }
}
