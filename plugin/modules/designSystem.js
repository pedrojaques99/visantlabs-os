/**
 * Design System module
 * Handles import, validation, storage and rendering of JSON design system tokens.
 * JSON is stored in the Figma file (figma.root.setPluginData) so it persists
 * and is shared across the team working on the same file.
 */

class DesignSystemModule {
  constructor() {
    this._loaded = false;
  }

  init() {
    if (this._loaded) return;
    this._loaded = true;

    // Load persisted design system on startup
    loadDesignSystem();

    // React to design system state changes (update badge/indicator in UI)
    watchState('designSystem', () => {
      this._renderBadge();
      this._renderPanel();
    });

    // Listen for data coming back from sandbox
    eventBus.on('designSystem:loaded', (data) => {
      setState('designSystem', data || null);
    });

    // Wire up UI events if the elements exist
    this._bindUI();
  }

  // ─── UI Bindings ────────────────────────────────────────────────────────────

  _bindUI() {
    // Import button inside Brand/Settings panel
    const importBtn = document.getElementById('dsImportBtn');
    const importInput = document.getElementById('dsImportInput');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', (e) => this._handleFileInput(e));
    }

    // Remove button
    const removeBtn = document.getElementById('dsRemoveBtn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => this._remove());
    }

    // Export button
    const exportBtn = document.getElementById('dsExportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this._export());
    }
  }

  _export() {
    const ds = state.designSystem;
    if (!ds) {
      eventBus.emit('chat:error-message', '❌ Nenhum Design System carregado para exportar.');
      return;
    }
    downloadJSON(ds, `${ds.name || 'design-system'}.json`);
  }


  // ─── File Import ─────────────────────────────────────────────────────────────

  /**
   * Handle file input change event (user selected a .json file via <input>)
   */
  async _handleFileInput(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = '';

    if (!file.name.endsWith('.json')) {
      eventBus.emit('chat:error-message', `❌ Apenas arquivos .json são suportados para Design System.`);
      return;
    }

    try {
      const text = await file.text();
      this.importFromJSONString(text, file.name);
    } catch (_) {
      eventBus.emit('chat:error-message', `❌ Erro ao ler o arquivo "${file.name}".`);
    }
  }

  /**
   * Try to import a JSON string as a Design System.
   * Called from:
   *   - File input (above)
   *   - chat.js when user attaches a .json file
   * Returns true if successfully parsed.
   */
  importFromJSONString(jsonString, filename = 'design-system.json') {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (_) {
      eventBus.emit('chat:error-message', `❌ JSON inválido em "${filename}". Verifique a sintaxe.`);
      return false;
    }

    // Detect if this JSON looks like a design system
    if (!this._isDesignSystem(parsed)) {
      return false; // Not a design system — let caller handle as regular attachment
    }

    const result = this._validate(parsed);
    if (!result.valid) {
      eventBus.emit('chat:error-message', `❌ Design System inválido: ${result.errors.join(' • ')}`);
      return false;
    }

    // Normalize and save
    const normalized = this._normalize(parsed);
    saveDesignSystem(normalized);

    const name = normalized.name || filename;
    const tokenCount = this._countTokens(normalized);
    eventBus.emit('chat:assistant-message', `✅ Design System **${name}** importado com sucesso! ${tokenCount} tokens disponíveis para geração.`);
    return true;
  }

  // ─── Detection & Validation ──────────────────────────────────────────────────

  /**
   * Returns true if the object looks like a Visant Design System JSON.
   * Requires at least one of: colors, typography, spacing, tokens.
   */
  _isDesignSystem(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    return !!(obj.colors || obj.typography || obj.spacing || obj.tokens || obj.radius || obj.shadows);
  }

  /**
   * Validate required structure and types.
   * Returns { valid: boolean, errors: string[] }
   */
  _validate(obj) {
    const errors = [];

    if (obj.colors !== undefined && typeof obj.colors !== 'object') {
      errors.push('"colors" deve ser um objeto');
    }
    if (obj.typography !== undefined && typeof obj.typography !== 'object') {
      errors.push('"typography" deve ser um objeto');
    }
    if (obj.spacing !== undefined && typeof obj.spacing !== 'object') {
      errors.push('"spacing" deve ser um objeto');
    }
    if (obj.radius !== undefined && typeof obj.radius !== 'object') {
      errors.push('"radius" deve ser um objeto');
    }
    if (obj.shadows !== undefined && typeof obj.shadows !== 'object') {
      errors.push('"shadows" deve ser um objeto');
    }
    if (obj.components !== undefined && typeof obj.components !== 'object') {
      errors.push('"components" deve ser um objeto');
    }
    if (obj.guidelines !== undefined && typeof obj.guidelines !== 'object') {
      errors.push('"guidelines" deve ser um objeto');
    }

    // Validate color values
    if (obj.colors) {
      for (const [key, val] of Object.entries(obj.colors)) {
        if (typeof val === 'string') {
          if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val) &&
            !val.startsWith('rgb') && !val.startsWith('hsl')) {
            errors.push(`colors.${key}: valor de cor inválido "${val}"`);
          }
        } else if (typeof val === 'object' && val !== null) {
          if (!val.hex && !val.value) {
            errors.push(`colors.${key}: objeto de cor deve ter "hex" ou "value"`);
          }
        } else {
          errors.push(`colors.${key}: tipo inválido`);
        }
      }
    }

    // Validate typography entries
    if (obj.typography) {
      for (const [key, val] of Object.entries(obj.typography)) {
        if (typeof val !== 'object' || !val.family) {
          errors.push(`typography.${key}: deve ter "family" (ex: "Inter")`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Normalize the incoming JSON to a consistent internal shape.
   * Supports flat tokens (W3C-like), Figma Tokens, and Visant format.
   */
  _normalize(raw) {
    // If it has a top-level "tokens" key (W3C Design Tokens / Figma Tokens format)
    if (raw.tokens && !raw.colors) {
      return this._normalizeTokensFormat(raw);
    }
    // Already in Visant format — just fill defaults
    return {
      $schema: 'visant/design-system/v1',
      name: raw.name || 'Design System',
      version: raw.version || '1.0',
      colors: raw.colors || {},
      typography: raw.typography || {},
      spacing: raw.spacing || {},
      radius: raw.radius || {},
      shadows: raw.shadows || {},
      components: raw.components || {},
      guidelines: raw.guidelines || {},
      _importedAt: new Date().toISOString(),
    };
  }

  /**
   * Normalize W3C Design Tokens / Figma Tokens format to Visant format.
   * { tokens: { colors: { primary: { $value: "#..." } } } }
   */
  _normalizeTokensFormat(raw) {
    const tokens = raw.tokens || {};
    const colors = {};
    const typography = {};
    const spacing = {};

    const flatten = (obj, prefix = '') => {
      for (const [key, val] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}-${key}` : key;
        if (val && typeof val === 'object') {
          if ('$value' in val) {
            // Leaf token
            const type = val.$type || '';
            if (type === 'color' || (typeof val.$value === 'string' && val.$value.startsWith('#'))) {
              colors[fullKey] = val.$value;
            } else if (type === 'dimension' || type === 'spacing') {
              const num = parseFloat(val.$value);
              if (!isNaN(num)) spacing[fullKey] = num;
            } else if (type === 'fontFamily' || type === 'typography') {
              typography[fullKey] = { family: val.$value };
            }
          } else {
            flatten(val, fullKey);
          }
        }
      }
    };

    if (tokens.color || tokens.colors) flatten(tokens.color || tokens.colors, '');
    if (tokens.spacing) flatten(tokens.spacing, '');
    if (tokens.typography) flatten(tokens.typography, '');
    // Try everything else too
    for (const [key, val] of Object.entries(tokens)) {
      if (!['color', 'colors', 'spacing', 'typography'].includes(key)) {
        flatten(val, key);
      }
    }

    return {
      $schema: 'visant/design-system/v1',
      name: raw.name || raw.title || 'Design System',
      version: raw.version || '1.0',
      colors,
      typography,
      spacing,
      radius: {},
      shadows: {},
      components: {},
      guidelines: {},
      _importedAt: new Date().toISOString(),
      _originalFormat: 'w3c-tokens',
    };
  }

  /**
   * Count total number of tokens across all categories
   */
  _countTokens(ds) {
    let count = 0;
    for (const cat of ['colors', 'typography', 'spacing', 'radius', 'shadows', 'components']) {
      if (ds[cat]) count += Object.keys(ds[cat]).length;
    }
    return count;
  }

  // ─── Remove ──────────────────────────────────────────────────────────────────

  _remove() {
    if (!confirm('Remover o Design System deste arquivo?')) return;
    saveDesignSystem(null);
    setState('designSystem', null);
  }

  // ─── UI Rendering ─────────────────────────────────────────────────────────────

  _renderBadge() {
    const badge = document.getElementById('dsBadge');
    if (!badge) return;
    const ds = state.designSystem;
    if (ds) {
      badge.textContent = ds.name || 'Design System';
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  _renderPanel() {
    const panel = document.getElementById('dsInfoPanel');
    if (!panel) return;

    const ds = state.designSystem;
    if (!ds) {
      panel.innerHTML = '<div class="ds-empty">Nenhum Design System importado.</div>';
      return;
    }

    const colorCount = Object.keys(ds.colors || {}).length;
    const typoCount = Object.keys(ds.typography || {}).length;
    const spacingCount = Object.keys(ds.spacing || {}).length;
    const compCount = Object.keys(ds.components || {}).length;

    const colorSwatches = Object.entries(ds.colors || {}).slice(0, 10).map(([name, val]) => {
      const hex = typeof val === 'string' ? val : (val.hex || val.value || '#ccc');
      return `<div class="ds-swatch" title="${this._escapeHtml(name)}" style="background:${this._escapeHtml(hex)}"></div>`;
    }).join('');

    panel.innerHTML = `
      <div class="ds-header">
        <span class="ds-name">${this._escapeHtml(ds.name || 'Design System')}</span>
        <span class="ds-version">v${this._escapeHtml(ds.version || '1.0')}</span>
      </div>
      <div class="ds-stats">
        ${colorCount ? `<span class="ds-stat">${colorCount} cores</span>` : ''}
        ${typoCount ? `<span class="ds-stat">${typoCount} tipografias</span>` : ''}
        ${spacingCount ? `<span class="ds-stat">${spacingCount} espaçamentos</span>` : ''}
        ${compCount ? `<span class="ds-stat">${compCount} componentes</span>` : ''}
      </div>
      ${colorSwatches ? `<div class="ds-swatches">${colorSwatches}</div>` : ''}
    `;
  }

  _escapeHtml(text) {
    return escapeHtml(text);
  }
}

const designSystemModule = new DesignSystemModule();
