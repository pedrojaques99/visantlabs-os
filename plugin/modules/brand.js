/**
 * Brand module — orchestrator for brand guidelines, logos, colors, fonts,
 * tokens, and UI components. Delegates colors to BrandColors and complex
 * modals to BrandModals (see plugin/modules/brand/).
 */

const WEBAPP_BASE_URL = {
  local: 'http://localhost:5173',
  prod: 'https://www.visantlabs.com',
};

class BrandModule {
  constructor() {
    // Flags for save management
    this._isLoadingConfig = false;
    this._saveDebounceTimer = null;

    // Core elements
    this.brandPill = document.getElementById('brandPill');
    this.colorGrid = document.getElementById('colorGrid');
    this.availableColorsList = document.getElementById('availableColorsList');
    this.fontList = document.getElementById('fontList');
    this.guidelineSelect = document.getElementById('guidelineSelect');

    // Brand Guideline API elements
    this.brandGuidelineSelect = document.getElementById('brandGuidelineSelect');
    this.brandGuidelineStatus = document.getElementById('brandGuidelineStatus');
    this.brandGuidelineRefreshBtn = document.getElementById('brandGuidelineRefreshBtn');

    // Design Tokens elements
    this.designTokensSection = document.getElementById('designTokensSection');
    this.tokenInputs = document.querySelectorAll('.token-input');

    // UI Components elements
    this.uiComponentsSection = document.getElementById('uiComponentsSection');
    this.componentSelects = document.querySelectorAll('.component-select');
    this.componentLibraryBtn = document.getElementById('componentLibraryBtn');
    this.componentsGrid = document.getElementById('componentsGrid');

    // Save status
    this.saveStatusIndicator = document.getElementById('saveStatusIndicator');
    this.saveStatusText = this.saveStatusIndicator?.querySelector('.save-status-text');

    // Font selection search
    this.fontSearch = document.getElementById('fontSearch');

    // Colors sub-module — handles role slots + extras
    this.colors = new BrandColors();

    this.setupEventListeners();
    this.setupStateListeners();
    this.setupCollapsibles();
    this.loadInitialData();
  }

  setupEventListeners() {
    // Brand pill toggle - enables/disables brand context for AI
    if (this.brandPill) {
      this.brandPill.addEventListener('click', (e) => {
        // If they click specifically on an icon or label to open settings, we could handle it,
        // but for now, let's keep it simple: click = toggle, double-click/long-press = settings?
        // Actually, let's follow the scan/think pattern: single click = toggle.
        const next = !state.useBrand;
        setState('useBrand', next);

        // Optional: still open settings if it's the first time or if they want to configure?
        // User asked for "using brand should be optional", so explicit toggle is priority.
      });

      // Special case: long press or some other way to open settings
      this.brandPill.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (window.uiManager) {
          window.uiManager.openBrandSettings();
          this.expandSection('brandApiSection');
        }
      });
    }


    // Guideline selection
    this.guidelineSelect?.addEventListener('change', (e) => {
      this.selectGuideline(e.target.value);
    });

    // Save guideline button
    document.getElementById('guidelineSaveBtn')?.addEventListener('click', () => {
      this.saveCurrentGuideline();
    });

    // Delete guideline button
    document.getElementById('guidelineDeleteBtn')?.addEventListener('click', () => {
      this.deleteCurrentGuideline();
    });

    // Auto-close any open <details> row menu when clicking outside
    document.addEventListener('click', (e) => {
      document.querySelectorAll('.brand-row-menu[open]').forEach(d => {
        if (!d.contains(e.target)) d.removeAttribute('open');
      });
    });

    // Color management — directly open native picker to add an extra color
    document.getElementById('colorAddBtn')?.addEventListener('click', () => {
      this.availableColorsList?.classList.add('hidden');
      this.colors.addExtra();
    });

    // Color library toggle — show/hide the file's available colors strip
    document.getElementById('colorImportBtn')?.addEventListener('click', () => {
      if (!this.availableColorsList) return;
      const isHidden = this.availableColorsList.classList.contains('hidden');
      if (!isHidden) {
        this.availableColorsList.classList.add('hidden');
        return;
      }
      this.availableColorsList.classList.remove('hidden');
      if (!state.allColors || state.allColors.length === 0) {
        getContext();
      } else {
        this.renderAvailableColors();
      }
    });

    // Font Buttons (open modal)
    document.querySelectorAll('.font-select-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-target');
        setState('activeModalTarget', target);
        document.getElementById('fontModal')?.classList.remove('hidden');
      });
    });

    // Logo Add Button
    document.getElementById('logoAddPropBtn')?.addEventListener('click', () => {
      this.addLogoProperty();
    });

    // Font Add Button
    document.getElementById('fontAddPropBtn')?.addEventListener('click', () => {
      this.addFontProperty();
    });

    // Brand Hub More Button
    document.getElementById('brandHubMoreBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('brandHubOverflowMenu')?.classList.toggle('hidden');
    });

    // ═══ BRAND GUIDELINE API ═══
    this.brandGuidelineSelect?.addEventListener('change', (e) => {
      this.linkBrandGuideline(e.target.value);
    });

    this.brandGuidelineRefreshBtn?.addEventListener('click', () => {
      // Manual refresh of selected guideline if update found
      if (this.brandGuidelineRefreshBtn.classList.contains('highlighted')) {
        this.linkBrandGuideline(state.linkedGuidelineId, { force: true });
      } else {
        // Otherwise just refresh list
        this.fetchBrandGuidelines();
      }
    });

    document.getElementById('brandGuidelineAddBtn')?.addEventListener('click', () => {
      this.createNewGuideline();
    });

    document.getElementById('brandGuidelineOpenBtn')?.addEventListener('click', () => {
      this.openGuidelineInWebapp();
    });

    document.getElementById('brandGuidelineUnlinkBtn')?.addEventListener('click', () => {
      this.linkBrandGuideline('');
      if (this.brandGuidelineSelect) this.brandGuidelineSelect.value = '';
    });

    // ═══ DESIGN TOKENS ═══
    this.tokenInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const [category, key] = e.target.dataset.token.split('.');
        this.updateToken(category, key, parseInt(e.target.value) || 0);
      });
    });

    // ═══ UI COMPONENTS ═══
    document.getElementById('componentAddBtn')?.addEventListener('click', () => {
      this.addCustomComponent();
    });

    this.componentLibraryBtn?.addEventListener('click', () => {
      setState('activeModalTarget', 'ui-component-__new__');
      this._openLibraryModal();
    });

    // ═══ EXPORT / IMPORT ═══
    document.getElementById('brandGuidelineExportBtn')?.addEventListener('click', () => {
      this.exportBrandJSON();
    });

    const importBtn = document.getElementById('brandGuidelineImportBtn');
    const importInput = document.getElementById('brandGuidelineImportInput');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', (e) => this.handleImportBrandJSON(e));
    }


    // ═══ SMART SCAN (multi-select → auto-fill brand slots) ═══
    const smartScanBtn = document.getElementById('brandSmartScanBtn');
    smartScanBtn?.addEventListener('click', async () => {
      if (!window.brandSyncModule) return;
      smartScanBtn.style.opacity = '0.5';
      smartScanBtn.style.pointerEvents = 'none';
      try {
        const items = await window.brandSyncModule.smartScan();
        if (!items || items.length === 0) {
          eventBus.emit('toast:error', { message: 'Select elements in Figma first' });
          return;
        }
        this._showSmartScanModal(items);
      } catch (e) {
        eventBus.emit('toast:error', { message: e.message || 'Scan failed' });
      } finally {
        smartScanBtn.style.opacity = '';
        smartScanBtn.style.pointerEvents = '';
      }
    });

    // ═══ FIGMA SYNC (push plugin state → webapp guideline) ═══
    const figmaSyncBtn = document.getElementById('brandFigmaSyncBtn');
    figmaSyncBtn?.addEventListener('click', () => {
      this._showPushToWebappPreview();
    });

    // Font search
    this.fontSearch?.addEventListener('input', () => {
      this.renderFontList();
    });

    // Font category tabs
    document.querySelectorAll('.font-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const category = e.target.getAttribute('data-category');
        setState('activeFontCategory', category);

        // Update UI active state
        document.querySelectorAll('.font-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });

    // Listen for library component selection
    eventBus.on('library:component-selected', (component) => {
      const target = state.activeModalTarget;
      if (target && target.startsWith('ui-component-')) {
        const type = target.replace('ui-component-', '');
        this.handleComponentCaptured(component, type);
        document.getElementById('componentModal')?.classList.add('hidden');
      } else if (target && target.startsWith('logo-')) {
        this.handleLogoCaptured(component);
        document.getElementById('componentModal')?.classList.add('hidden');
      }
    });

    // Initial render
    this.renderComponentsGrid();

    // Listen for brand updates found on server
    eventBus?.on('brand:update-available', (serverData) => {
      this.showUpdateAvailable(serverData);
    });

    eventBus?.on('brand:synchronized', () => {
      this.showSynchronized();
    });
  }

  /**
   * Expand a specific collapsible section in the Brand tab
   * @param {string} sectionId 
   */
  expandSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    // Aggressive Accordion: Close others in the same group
    const group = section.closest('.figma-prop-panel') || section.parentElement;
    group.querySelectorAll('.collapsible').forEach(s => {
      if (s !== section) s.classList.add('collapsed');
      else s.classList.remove('collapsed');
    });

    // Make sure the content isn't hidden by legacy .hidden class if applicable
    const contentId = section.querySelector('.collapsible-header')?.dataset.target;
    if (contentId) {
      const content = document.getElementById(contentId);
      if (content) content.classList.remove('hidden');
    }

    // Smooth scroll into view
    setTimeout(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // ═══ COLLAPSIBLE SECTIONS ═══
  setupCollapsibles() {
    document.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.collapsible');
        section?.classList.toggle('collapsed');
      });
    });
  }

  setupStateListeners() {
    watchState('logos', () => { this.renderLogos(); this.updateBrandPill(); });
    watchState('typography', () => { this.renderFonts(); this.updateBrandPill(); });
    watchState('activeFontCategory', () => this.renderFontList());

    watchState('selectedColors', () => {
      this.renderColorGrid();
      this.updateBrandPill();
    });

    watchState('useBrand', () => {
      this.updateBrandPill();
    });


    watchState('savedGuidelines', () => {
      this.renderGuidelinesSelector();
    });

    watchState('authToken', (token) => {
      if (token) {
        this.fetchBrandGuidelines();
      } else {
        setState('apiGuidelines', []);
        this.renderBrandGuidelineSelect([]);
      }
    });

    // Auto-save on all brand config changes
    const configPaths = [
      'logos', 'typography', 'selectedColors',
      'linkedGuidelineId', 'designTokens',
      'selectedUIComponents', 'customComponentTypes',
      'useBrand'
    ];

    configPaths.forEach(path => {
      watchState(path, () => {
        this.saveLocalBrandConfig();
      });
    });

    // Listen for sandbox results
    eventBus.on('selection:logo-result', (logo) => this.handleLogoCaptured(logo));
    eventBus.on('selection:font-result', (font) => this.handleFontCaptured(font));

    // Listen for local brand config from sandbox
    eventBus.on('state:local-brand-loaded', (config) => {
      if (!config) return;

      // Set loading flag to prevent auto-saves during state restoration
      this._isLoadingConfig = true;

      try {
        // Core brand
        if (config.logos) setState('logos', config.logos);
        if (config.typography) setState('typography', config.typography);

        // Backward compatibility transition
        if (!config.logos && config.logoLight) {
          setState('logos', [
            { id: 'light', label: 'Light Mode', value: config.logoLight },
            { id: 'dark', label: 'Dark Mode', value: config.logoDark },
            { id: 'accent', label: 'Accent', value: config.logoAccent }
          ]);
        }
        if (!config.typography && config.fontPrimary) {
          const toFamilyValue = (f) => f ? { family: f.family || f.name, availableStyles: [f.style || 'Regular'] } : null;
          setState('typography', [
            { id: 'primary', label: 'Primary', value: toFamilyValue(config.fontPrimary) },
            { id: 'secondary', label: 'Secondary', value: toFamilyValue(config.fontSecondary) }
          ]);
        }
        if (config.selectedColors) {
          setState('selectedColors', new Map(Object.entries(config.selectedColors)));
        }
        // API link - only restore UI state, don't re-fetch (avoids race condition)
        if (config.linkedGuidelineId) {
          setState('linkedGuidelineId', config.linkedGuidelineId);
          // Restore selection UI without triggering full API call
          if (this.brandGuidelineSelect) {
            this.brandGuidelineSelect.value = config.linkedGuidelineId;
          }
          // Show open button
          // Show linked status from cached guideline if available
          const cachedGuideline = state.apiGuidelines?.find(g =>
            (g.id || g._id) === config.linkedGuidelineId
          );
          if (cachedGuideline) {
            setState('linkedGuideline', cachedGuideline);
            this.updateBrandGuidelineStatus(cachedGuideline);
          }
        }
        // Design tokens
        if (config.designTokens) {
          setState('designTokens', config.designTokens);
          this.renderTokenInputs(config.designTokens);
        }
        // UI Components
        if (config.selectedUIComponents) {
          setState('selectedUIComponents', config.selectedUIComponents);
        }
        if (config.customComponentTypes) {
          setState('customComponentTypes', config.customComponentTypes);
        }
        // Re-render UI
        this.renderComponentsGrid();
        this.renderLogos();
        this.renderColorGrid();
        this.updateBrandPill();
      } finally {
        // Always reset loading flag
        this._isLoadingConfig = false;
      }
    });

    // Listen for context updates from sandbox
    eventBus.on('context:colors-loaded', (colors) => {
      setState('allColors', colors);
      this.renderAvailableColors();
    });

    eventBus.on('context:fonts-loaded', (fonts) => {
      setState('allFonts', fonts);
      this.renderFontList();
    });

    eventBus.on('context:available-fonts-loaded', (fonts) => {
      setState('allAvailableFonts', fonts);
    });

    eventBus.on('guidelines:loaded', (guidelines) => {
      setState('savedGuidelines', guidelines);
      this.renderGuidelinesSelector();
    });

    eventBus.on('guideline:saved', (data) => {
      setState('savedGuidelines', data.guidelines);
      setState('activeGuidelineId', data.savedId);
      this.renderGuidelinesSelector();
    });

    // Listen for logo selection from current selection
    eventBus.on('selection:logo-result', (component) => {
      const target = state.activeModalTarget;
      if (['logoLight', 'logoDark', 'logoAccent'].includes(target)) {
        if (component) {
          setState(target, component);
          console.log(`[Brand] Logo ${target} updated from selection:`, component.name);
        } else {
          console.warn('[Brand] No valid component selected');
        }
        setState('activeModalTarget', null);
      }
    });

    // Listen for font selection from current selection
    eventBus.on('selection:font-result', (font) => {
      const target = state.activeModalTarget;
      if (['fontPrimary', 'fontSecondary'].includes(target)) {
        if (font) {
          setState(target, font);
          console.log(`[Brand] Font ${target} updated from selection:`, font.name);
        } else {
          console.warn('[Brand] No text node selected or font not found');
        }
        setState('activeModalTarget', null);
      }
    });

    // Listen for component selection from the modal (via library module)
    eventBus.on('library:component-selected', (component) => {
      const target = state.activeModalTarget;
      if (['logoLight', 'logoDark', 'logoAccent'].includes(target)) {
        // Enriched component with thumbnail from library state
        const thumb = state.componentThumbs[component.id];
        const enrichedComponent = { ...component, thumbnail: thumb };

        setState(target, enrichedComponent);
        document.getElementById('componentModal')?.classList.add('hidden');
        setState('activeModalTarget', null);
      }
    });

    // Listen for available components (for UI component selectors)
    eventBus.on('context:components-loaded', (components) => {
      setState('availableComponents', components);
      this.renderComponentsGrid();
    });

    // Listen for component capture result
    eventBus.on('selection:component-captured', (component) => {
      this.handleComponentCaptured(component);
    });
  }

  loadInitialData() {
    // Request initial data from sandbox
    getContext();
    loadGuidelines();

    // Request local brand config
    parent.postMessage({ pluginMessage: { type: 'GET_LOCAL_BRAND_CONFIG' } }, '*');

    // Fetch brand guidelines from API (if authenticated)
    this.fetchBrandGuidelines();
  }

  /**
   * Save local brand config to Figma pluginData (debounced)
   * @param {boolean} immediate - Skip debounce and save immediately
   */
  saveLocalBrandConfig(immediate = false) {
    // Skip save during initial load to avoid redundant saves
    if (this._isLoadingConfig) {
      return;
    }

    // Visual feedback - Saving
    if (this.saveStatusIndicator) {
      this.saveStatusIndicator.classList.add('saving');
      if (this.saveStatusText) this.saveStatusText.textContent = 'Salvando...';
    }

    // Clear existing timer
    if (this._saveDebounceTimer) {
      clearTimeout(this._saveDebounceTimer);
    }

    const doSave = () => {
      const config = {
        // Core brand
        logos: state.logos,
        typography: state.typography,
        selectedColors: state.selectedColors instanceof Map
          ? Object.fromEntries(state.selectedColors)
          : (state.selectedColors || {}),
        // API link
        linkedGuidelineId: state.linkedGuidelineId,
        // Design tokens - read from state, fallback to DOM
        designTokens: state.designTokens || this.getTokens(),
        // UI Components
        selectedUIComponents: state.selectedUIComponents || {},
        customComponentTypes: state.customComponentTypes || []
      };

      console.log('[Brand] Saving local config:', config);
      parent.postMessage({
        pluginMessage: {
          type: 'SAVE_LOCAL_BRAND_CONFIG',
          config
        }
      }, '*');

      // Visual feedback - Done (after small delay to feel "real")
      setTimeout(() => {
        if (this.saveStatusIndicator) {
          this.saveStatusIndicator.classList.remove('saving');
          if (this.saveStatusText) this.saveStatusText.textContent = 'Sincronizado';
        }
      }, 600);
    };

    if (immediate) {
      doSave();
    } else {
      // Debounce saves by 500ms (optimized for rate limit)
      this._saveDebounceTimer = setTimeout(doSave, 500);
    }
  }

  /**
   * Export brand config as JSON
   */
  exportBrandJSON() {
    const config = {
      name: state.linkedGuideline?.identity?.name || 'Local Brand',
      logos: state.logos,
      typography: state.typography,
      colors: state.selectedColors instanceof Map
        ? Object.fromEntries(state.selectedColors)
        : (state.selectedColors || {}),
      tokens: state.designTokens,
      uiComponents: state.selectedUIComponents,
      _exportedAt: new Date().toISOString()
    };

    console.log('[Brand] Exporting JSON...', config);
    downloadJSON(config, `brand-${config.name.toLowerCase().replace(/\s+/g, '-')}.json`);
  }

  /**
   * Import brand config from JSON
   */
  async handleImportBrandJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // Reset input so same file can be selected again

    try {
      const text = await file.text();
      const config = JSON.parse(text);
      console.log('[Brand] Importing JSON...', config);

      if (!config.logos && !config.colors && !config.tokens && !config.typography && !config.uiComponents) {
        eventBus.emit('chat:error-message', '❌ JSON inválido para configuração de Brand (sem propriedades de brand).');
        return;
      }

      // Set loading flag to prevent auto-saves while state is syncing
      this._isLoadingConfig = true;

      // Restore states
      if (config.logos) setState('logos', config.logos);
      if (config.typography) setState('typography', config.typography);
      if (config.colors) setState('selectedColors', new Map(Object.entries(config.colors)));
      if (config.tokens) {
        setState('designTokens', config.tokens);
        this.renderTokenInputs(config.tokens);
      }
      if (config.uiComponents) setState('selectedUIComponents', config.uiComponents);

      // Trigger UI updates manually where watchState may not fully cover it due to debounce
      this.renderLogos();
      this.renderColorGrid();
      this.renderComponentsGrid();
      this.updateBrandPill();

      this._isLoadingConfig = false;
      this.saveLocalBrandConfig(true); // Persist immediately after import

      eventBus.emit('chat:assistant-message', `✅ App Brand Configuration **${config.name || 'importada'}** com sucesso!`);
    } catch (err) {
      console.error('[Brand] Import error', err);
      eventBus.emit('chat:error-message', '❌ Erro ao importar JSON de Brand. Verifique o arquivo.');
    }
  }


  // ═══ SMART SCAN MODAL ═══
  _showSmartScanModal(items) {
    BrandModals.showSmartScan(items, (assignments) => BrandModals.applySmartScan(assignments));
  }

  _applySmartScan(assignments) {
    BrandModals.applySmartScan(assignments);
  }

  // ═══ PUSH TO WEBAPP PREVIEW ═══
  async _showPushToWebappPreview() {
    return BrandModals.showPushToWebapp(this);
  }


  /**
   * Update brand pill indicator
   */
  updateBrandPill() {
    if (!this.brandPill) return;

    const isAvailable = isBrandConfigured();
    const isActive = state.useBrand;

    // Active state: visually highlighted (the toggle)
    this.brandPill.classList.toggle('active', isActive);

    // Status indicator: color the icon or add a dot if configured but inactive
    if (isAvailable) {
      this.brandPill.style.color = isActive
        ? 'var(--figma-color-text-onbrand, #fff)'
        : 'var(--figma-color-text-brand, #0d99ff)';
    } else {
      this.brandPill.style.color = '';
    }

    const summary = getBrandSummary();
    const tooltip = isActive
      ? `Branding Ativo (${summary})`
      : (isAvailable ? `Branding Desativado (Configurado: ${summary})` : 'Brand não configurada');

    this.brandPill.title = tooltip + ' • Botão direito para gerenciar';
  }


  /**
   * Render dynamic logos
   */
  renderLogos() {
    const list = document.getElementById('logoList');
    if (!list) return;

    list.innerHTML = '';
    state.logos.forEach((logo, index) => {
      const row = document.createElement('div');
      row.className = 'brand-row';

      const val = logo.value;
      const isConfigured = !!val;
      const canRemove = state.logos.length > 1;

      row.innerHTML = `
        <button class="brand-row-preview ${isConfigured ? 'is-set' : 'is-empty'}" data-index="${index}" title="${isConfigured ? 'Trocar logo' : 'Escolher da biblioteca'}">
          ${isConfigured && val.thumbnail
          ? `<img src="${val.thumbnail}" alt="">`
          : '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>'}
        </button>
        <input type="text" class="brand-row-label" value="${this.escapeHtml(logo.label)}" data-index="${index}" title="Renomear" />
        <details class="brand-row-menu">
          <summary class="figma-icon-btn" title="Mais opções">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="3" r="1" fill="currentColor"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="9" r="1" fill="currentColor"/></svg>
          </summary>
          <div class="brand-row-menu-popup">
            <button class="menu-item" data-action="library">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="2" width="9" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 5h9" stroke="currentColor" stroke-width="1.2"/></svg>
              Escolher da biblioteca
            </button>
            <button class="menu-item" data-action="capture">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 1.5L9 5L6.5 6L8 9.5L7 10L5.5 6.5L4 8V1.5Z" fill="currentColor"/></svg>
              Usar seleção atual
            </button>
            ${isConfigured ? `
              <button class="menu-item" data-action="clear">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
                Limpar valor
              </button>` : ''}
            ${canRemove ? `
              <button class="menu-item menu-item--danger" data-action="remove">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3.5h8M4.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M3.5 3.5l.5 7a.5.5 0 00.5.5h3a.5.5 0 00.5-.5l.5-7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                Remover variante
              </button>` : ''}
          </div>
        </details>
      `;

      const closeMenu = () => row.querySelector('.brand-row-menu')?.removeAttribute('open');

      // Preview click → open library
      row.querySelector('.brand-row-preview').addEventListener('click', () => {
        setState('activeModalTarget', `logo-${index}`);
        this._openLibraryModal();
      });

      // Label edit
      row.querySelector('.brand-row-label').addEventListener('change', (e) => {
        const updated = [...state.logos];
        updated[index].label = e.target.value;
        setState('logos', updated);
      });

      // Per-row menu actions (event delegation)
      row.querySelector('.brand-row-menu-popup').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        closeMenu();
        if (action === 'library') {
          setState('activeModalTarget', `logo-${index}`);
          this._openLibraryModal();
        } else if (action === 'capture') {
          setState('activeModalTarget', `logo-${index}`);
          parent.postMessage({ pluginMessage: { type: 'USE_SELECTION_AS_LOGO' } }, '*');
        } else if (action === 'clear') {
          const updated = [...state.logos];
          updated[index].value = null;
          setState('logos', updated);
        } else if (action === 'remove') {
          this.removeLogoProperty(index);
        }
      });

      list.appendChild(row);
    });
  }

  /** Open the library modal with a contextual title based on activeModalTarget. */
  _openLibraryModal() {
    const modal = document.getElementById('componentModal');
    const title = document.getElementById('componentModalTitle');
    if (title) {
      const target = state.activeModalTarget || '';
      title.textContent = target.startsWith('logo-')
        ? 'Escolher Logo'
        : target.startsWith('ui-component-')
          ? 'Escolher Componente'
          : 'Escolher da Biblioteca';
    }
    modal?.classList.remove('hidden');
  }

  /**
   * Render dynamic typography — family-first approach
   */
  renderFonts() {
    const list = document.getElementById('fontPropList');
    if (!list) return;

    list.innerHTML = '';
    state.typography.forEach((font, index) => {
      const row = document.createElement('div');
      row.className = 'figma-prop-row';

      const val = font.value;
      const isConfigured = !!val;
      const familyName = val?.family || '';
      const styleCount = val?.availableStyles?.length || 0;
      const isRequired = font.id === 'primary' || font.id === 'secondary';

      row.innerHTML = `
        <div class="figma-prop-label-container" style="display:flex; align-items:center; gap:4px; width:80px; flex-shrink:0;">
          <input type="text" class="figma-prop-label-editable" value="${this.escapeHtml(font.label)}" data-index="${index}" title="Renomear propriedade" />
          ${isRequired ? '<span class="required-indicator" title="Obrigatório" style="color:var(--brand-cyan); font-weight:bold;">*</span>' : ''}
        </div>
        <div class="figma-prop-value ${isConfigured ? '' : (isRequired ? 'text-muted-urgent' : 'text-muted')}" style="flex: 1; min-width: 0;">
          ${isConfigured
          ? `<div class="brand-label" title="${this.escapeHtml(familyName)}">${this.escapeHtml(familyName)}${styleCount ? ` <span style="opacity:0.5;font-size:10px">${styleCount} pesos</span>` : ''}</div>`
          : (isRequired ? '<strong>Vincule uma família</strong>' : 'Escolher família')}
        </div>
        <div class="row-actions" style="display: flex; gap: 2px;">
          ${isConfigured ? `
            <button class="figma-icon-btn btn-remove-item" data-index="${index}" title="Limpar valor">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
          ` : ''}
          <button class="figma-icon-btn font-capture-btn" data-index="${index}" title="Capturar da seleção">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 1.5L9 5L6.5 6L8 9.5L7 10L5.5 6.5L4 8V1.5Z" fill="currentColor"/></svg>
          </button>
          <button class="figma-icon-btn font-select-btn" data-index="${index}" title="Escolher família">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.5 5.5V1h-1v4.5H1v1h4.5V11h1V6.5H11v-1H6.5z" fill="currentColor" /></svg>
          </button>
          ${state.typography.length > 1 ? `
            <button class="figma-icon-btn font-remove-prop-btn" data-index="${index}" title="Remover propriedade">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.5"/></svg>
            </button>
          ` : ''}
        </div>
      `;

      // Label Edit
      row.querySelector('.figma-prop-label-editable').addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        const updatedTypo = [...state.typography];
        updatedTypo[idx].label = e.target.value;
        setState('typography', updatedTypo);
      });

      // Clear Value
      row.querySelector('.btn-remove-item')?.addEventListener('click', () => {
        const updatedTypo = [...state.typography];
        updatedTypo[index].value = null;
        setState('typography', updatedTypo);
      });

      // Capture from selection — extracts just the family
      row.querySelector('.font-capture-btn').addEventListener('click', () => {
        setState('activeModalTarget', `font-${index}`);
        parent.postMessage({ pluginMessage: { type: 'USE_SELECTION_AS_FONT' } }, '*');
      });

      // Select from library
      row.querySelector('.font-select-btn').addEventListener('click', () => {
        setState('activeModalTarget', `font-${index}`);
        document.getElementById('fontModal')?.classList.remove('hidden');
      });

      // Remove Property
      row.querySelector('.font-remove-prop-btn')?.addEventListener('click', () => {
        this.removeFontProperty(index);
      });

      list.appendChild(row);
    });
  }

  /**
   * Add a new logo property
   */
  addLogoProperty() {
    const updatedLogos = [...state.logos];
    updatedLogos.push({
      id: `custom-${Date.now()}`,
      label: 'Novo Logo',
      value: null
    });
    setState('logos', updatedLogos);
  }

  /**
   * Remove a logo property
   */
  removeLogoProperty(index) {
    if (state.logos.length <= 1) return;
    const updatedLogos = [...state.logos];
    updatedLogos.splice(index, 1);
    setState('logos', updatedLogos);
  }

  /**
   * Add a new typography property
   */
  addFontProperty() {
    const updatedTypo = [...state.typography];
    updatedTypo.push({
      id: `custom-${Date.now()}`,
      label: 'Nova Fonte',
      value: null
    });
    setState('typography', updatedTypo);
  }

  /**
   * Remove a typography property
   */
  removeFontProperty(index) {
    if (state.typography.length <= 1) return;
    const updatedTypo = [...state.typography];
    updatedTypo.splice(index, 1);
    setState('typography', updatedTypo);
  }

  /**
   * Handle captured logo from sandbox
   */
  handleLogoCaptured(logo) {
    const target = state.activeModalTarget;
    if (!target || !target.startsWith('logo-')) return;
    const index = parseInt(target.split('-')[1]);
    const updatedLogos = [...state.logos];
    if (updatedLogos[index]) {
      // Enrich with thumbnail from library state if not already present
      const thumb = logo?.thumbnail || (logo?.id ? state.componentThumbs?.[logo.id] : null);
      updatedLogos[index].value = thumb ? { ...logo, thumbnail: thumb } : logo;
      setState('logos', updatedLogos);
    }
    setState('activeModalTarget', null);
  }

  /**
   * Handle font captured from selection — extract family + resolve available styles
   */
  handleFontCaptured(font) {
    const target = state.activeModalTarget;
    if (!target || !target.startsWith('font-')) return;
    const index = parseInt(target.split('-')[1]);
    const updatedTypo = [...state.typography];
    if (updatedTypo[index]) {
      const family = font?.family || font?.name || '';
      // Resolve available styles from allFonts
      const styles = (state.allFonts || [])
        .filter(f => (f.family || f.name) === family)
        .map(f => f.style || 'Regular')
        .filter((v, i, a) => a.indexOf(v) === i);
      updatedTypo[index].value = { family, availableStyles: styles.length > 0 ? styles : ['Regular'] };
      setState('typography', updatedTypo);
    }
    setState('activeModalTarget', null);
  }

  /**
   * Handle family selected from the font picker modal
   */
  handleFontFamilySelected(entry) {
    const target = state.activeModalTarget;
    if (!target || !target.startsWith('font-')) return;
    const index = parseInt(target.split('-')[1]);
    const updatedTypo = [...state.typography];
    if (updatedTypo[index]) {
      updatedTypo[index].value = { family: entry.family, availableStyles: entry.styles || ['Regular'] };
      setState('typography', updatedTypo);
    }
    setState('activeModalTarget', null);
  }

  /** Render color grid — delegates to BrandColors (preset role slots). */
  renderColorGrid() {
    this.colors.render();
  }

  /** Add a free-form extra color (opens native picker). */
  addManualColor() {
    this.colors.addExtra();
  }

  /** Render library colors strip — delegated to brandColors */
  renderAvailableColors() {
    this.colors.renderAvailableColors();
  }

  /**
   * Render font list
   */
  /**
   * Group allFonts by family, returning { family, styles[] } entries
   */
  _groupFontsByFamily() {
    const familyMap = new Map();
    for (const f of (state.allFonts || [])) {
      const family = f.family || f.name;
      if (!familyMap.has(family)) {
        familyMap.set(family, { family, styles: [] });
      }
      const style = f.style || 'Regular';
      if (!familyMap.get(family).styles.includes(style)) {
        familyMap.get(family).styles.push(style);
      }
    }
    return [...familyMap.values()];
  }

  renderFontList() {
    if (!this.fontList) return;

    const query = this.fontSearch?.value.toLowerCase() || '';
    const category = state.activeFontCategory || 'all';

    const allFamilies = this._groupFontsByFamily();

    const filtered = allFamilies.filter(f => {
      const fam = f.family.toLowerCase();
      if (query && !fam.includes(query)) return false;
      if (category === 'all') return true;
      if (category === 'sans') return fam.includes('sans') || ['inter', 'roboto', 'helvetica', 'arial', 'lato', 'barlow', 'poppins', 'montserrat', 'nunito', 'raleway', 'outfit'].some(k => fam.includes(k));
      if (category === 'serif') return fam.includes('serif') || ['times', 'georgia', 'palatino', 'playfair', 'merriweather', 'lora', 'crimson'].some(k => fam.includes(k));
      if (category === 'mono') return fam.includes('mono') || ['code', 'courier', 'fira', 'consolas', 'jetbrains'].some(k => fam.includes(k));
      return true;
    });

    if (filtered.length === 0) {
      this.fontList.innerHTML = query || category !== 'all'
        ? '<div class="text-muted" style="text-align:center; padding: 20px;">Nenhuma família corresponde</div>'
        : '<div class="text-muted" style="text-align:center; padding: 20px;">Carregando fontes...</div>';
      return;
    }

    this.fontList.innerHTML = '';

    // Show up to 80 families for performance
    for (const entry of filtered.slice(0, 80)) {
      const div = document.createElement('div');
      div.className = 'font-item clickable';
      div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 10px; border-radius: 6px; border: 1px solid var(--figma-color-border); margin-bottom: 4px; cursor: pointer;';

      const left = document.createElement('div');
      left.style.cssText = 'display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;';

      const preview = document.createElement('div');
      preview.style.cssText = `font-family: "${entry.family}"; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
      preview.textContent = entry.family;

      const meta = document.createElement('div');
      meta.style.cssText = 'font-size: 10px; color: var(--figma-color-text-tertiary);';
      meta.textContent = `${entry.styles.length} peso${entry.styles.length !== 1 ? 's' : ''}`;

      left.appendChild(preview);
      left.appendChild(meta);
      div.appendChild(left);

      div.addEventListener('click', () => {
        this.handleFontFamilySelected(entry);
        document.getElementById('fontModal')?.classList.add('hidden');
        setState('activeModalTarget', null);
      });

      this.fontList.appendChild(div);
    }
  }

  /**
   * Show available fonts for selection
   */
  showAvailableFonts() {
    setState('activeFontTab', 'available');
    eventBus.emit('ui:switch-tab', 'available');
  }

  /**
   * Render guidelines selector
   */
  renderGuidelinesSelector() {
    if (!this.guidelineSelect) return;

    const prevValue = this.guidelineSelect.value;
    this.guidelineSelect.innerHTML = '<option value="">— Nenhum —</option>';

    for (const guideline of state.savedGuidelines) {
      const opt = document.createElement('option');
      opt.value = guideline.id;
      opt.textContent = this.escapeHtml(guideline.name);
      this.guidelineSelect.appendChild(opt);
    }

    this.guidelineSelect.value = state.activeGuidelineId || '';
  }

  /**
   * Select a guideline
   * @param {string} id - Guideline ID
   */
  selectGuideline(id) {
    if (!id) {
      setState('activeGuidelineId', null);
      return;
    }

    const guideline = state.savedGuidelines.find((g) => g.id === id);
    if (guideline) {
      setState('activeGuidelineId', id);
      if (guideline.logos) setState('logos', guideline.logos);
      if (guideline.typography) setState('typography', guideline.typography);

      // Legacy fallback
      if (!guideline.logos && guideline.logoLight) {
        setState('logos', [
          { id: 'light', label: 'Light Mode', value: guideline.logoLight },
          { id: 'dark', label: 'Dark Mode', value: guideline.logoDark },
          { id: 'accent', label: 'Accent', value: guideline.logoAccent }
        ]);
      }
      if (!guideline.typography && guideline.fontPrimary) {
        const toFamilyValue = (f) => f ? { family: f.family || f.name, availableStyles: [f.style || 'Regular'] } : null;
        setState('typography', [
          { id: 'primary', label: 'Primary', value: toFamilyValue(guideline.fontPrimary) },
          { id: 'secondary', label: 'Secondary', value: toFamilyValue(guideline.fontSecondary) }
        ]);
      }

      if (guideline.colors) {
        const colors = new Map();
        for (const c of guideline.colors) {
          colors.set(c.id, c);
        }
        setState('selectedColors', colors);
      }

      window.showToast?.(`Marca "${guideline.name}" carregada com sucesso.`, 'success');
    }
  }

  /**
   * Save current brand configuration as guideline
   */
  saveCurrentGuideline() {
    const name = prompt('Nome do guideline:', '');
    if (!name || !name.trim()) return;

    const guideline = {
      id: state.activeGuidelineId || String(Date.now()),
      name: name.trim(),
      logos: state.logos,
      typography: state.typography,
      colors: Array.from(state.selectedColors.values()),
    };

    saveBrandGuideline(guideline);
  }

  /**
   * Delete current guideline
   */
  deleteCurrentGuideline() {
    if (!state.activeGuidelineId) return;
    if (!confirm('Remover este guideline?')) return;

    deleteBrandGuideline(state.activeGuidelineId);
    setState('activeGuidelineId', null);
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    return escapeHtml(text);
  }

  // ═══════════════════════════════════════════════════════════════
  // BRAND GUIDELINE API METHODS (delegates to brandSyncModule)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fetch brand guidelines from API via brandSyncModule
   */
  async fetchBrandGuidelines() {
    if (!window.brandSyncModule) return;

    const guidelines = await window.brandSyncModule.fetchList();
    setState('apiGuidelines', guidelines);
    this.renderBrandGuidelineSelect(guidelines);
  }

  /**
   * Create a new brand guideline
   */
  async createNewGuideline() {
    // window.prompt() is natively blocked in Figma iframes and silently fails/returns null.
    // Instead of failing silently, we create the guideline directly.
    const name = `Nova Marca - ${new Date().toLocaleDateString()}`;


    if (!window.brandSyncModule) {
      console.warn('[Brand] brandSyncModule not available');
      return;
    }

    try {
      const guideline = await window.brandSyncModule.create({
        identity: { name: name.trim() }
      });

      if (guideline) {
        // Refresh list and select the new guideline
        await this.fetchBrandGuidelines();
        const id = guideline.id || guideline._id;
        if (id) {
          this.brandGuidelineSelect.value = id;
          await this.linkBrandGuideline(id);
        }
      }
    } catch (e) {
      console.error('[Brand] Failed to create guideline:', e);
      alert('Erro ao criar guideline. Verifique se está autenticado.');
    }
  }

  /**
   * Render brand guideline select options
   */
  renderBrandGuidelineSelect(guidelines = []) {
    if (!this.brandGuidelineSelect) return;

    this.brandGuidelineSelect.innerHTML = '<option value="">— Selecione uma marca —</option>';

    guidelines.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id || g._id;
      opt.textContent = g.identity?.name || 'Sem nome';
      this.brandGuidelineSelect.appendChild(opt);
    });

    // Restore selection if linked
    const linkedId = state.linkedGuidelineId;
    if (linkedId) {
      this.brandGuidelineSelect.value = linkedId;
    }
  }

  /**
   * Link a brand guideline from API via brandSyncModule
   */
  async linkBrandGuideline(guidelineId, options = {}) {
    if (!guidelineId) {
      // Unlink
      setState('linkedGuidelineId', null);
      setState('linkedGuideline', null);
      setState('brandGuideline', null);
      this.updateBrandGuidelineStatus(null);
      parent.postMessage({ pluginMessage: { type: 'LINK_GUIDELINE', guidelineId: null } }, '*');
      return;
    }

    if (!window.brandSyncModule) return;

    // Use brandSyncModule.select() which handles caching and state
    const guideline = await window.brandSyncModule.select(guidelineId, options);
    if (guideline) {
      setState('linkedGuidelineId', guidelineId);
      setState('linkedGuideline', guideline);

      // Auto-populate colors, typography, tokens
      this.applyGuidelineToState(guideline);
      this.updateBrandGuidelineStatus(guideline);

      // Save link to Figma file
      parent.postMessage({ pluginMessage: { type: 'LINK_GUIDELINE', guidelineId, autoLoad: true } }, '*');
    }
  }

  /**
   * Open current guideline in webapp
   */
  openGuidelineInWebapp() {
    const guidelineId = state.linkedGuidelineId;
    if (!guidelineId) {
      console.warn('[Brand] No guideline selected');
      return;
    }
    // Open in new tab - webapp URL
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? WEBAPP_BASE_URL.local : WEBAPP_BASE_URL.prod;
    window.open(`${baseUrl}/brand-guidelines?id=${guidelineId}`, '_blank');
  }

  /**
   * Apply guideline data to current state
   */
  applyGuidelineToState(guideline) {
    if (!guideline) return;

    // Logos — map API shape { id, url, variant, label } to state shape { id, label, value }
    if (guideline.logos?.length) {
      setState('logos', guideline.logos.map((l, i) => ({
        id: l.id || `logo-${i}`,
        label: l.label || l.variant || `Logo ${i + 1}`,
        value: l.url || l.value || null,
        variant: l.variant,
      })));
    } else {
      setState('logos', []);
    }

    // Colors — key by role when present so the new role-slot UI picks them up
    if (guideline.colors?.length) {
      const colorMap = new Map();
      guideline.colors.forEach((c, i) => {
        const role = c.role || '';
        const id = role ? `role-${role}` : `api-color-${i}`;
        colorMap.set(id, { id, name: c.name, value: c.hex, role });
      });
      setState('selectedColors', colorMap);
    }

    // Typography (map to first two)
    if (guideline.typography?.length) {
      setState('typography', guideline.typography.map((t, i) => ({
        id: t.id || `font-${i}`,
        label: t.role || (i === 0 ? 'Primary' : 'Secondary'),
        value: { family: t.family, availableStyles: t.availableStyles || [t.style || 'Regular'] }
      })));
    }

    // Tokens
    if (guideline.tokens) {
      setState('designTokens', guideline.tokens);
      this.renderTokenInputs(guideline.tokens);
    }
    // watchState auto-saves all fields (debounced)
  }

  /**
   * Update brand guideline status indicator
   */
  updateBrandGuidelineStatus(guideline) {
    const selectContainer = document.getElementById('brandSelectContainer');
    const linkedContainer = document.getElementById('brandLinkedContainer');
    const linkedName = document.getElementById('brandLinkedName');

    if (guideline || state.linkedGuidelineId) {
      if (selectContainer) selectContainer.classList.add('hidden');
      if (linkedContainer) linkedContainer.classList.remove('hidden');

      if (linkedName && guideline) {
        linkedName.textContent = guideline.identity?.name || 'Marca vinculada';
      } else if (linkedName && !guideline) {
        linkedName.textContent = 'Carregando marca...';
      }

      // Default to hidden unless update detected
      this.brandGuidelineRefreshBtn?.classList.remove('highlighted');
      this.brandGuidelineRefreshBtn?.classList.add('hidden');
    } else {
      if (selectContainer) selectContainer.classList.remove('hidden');
      if (linkedContainer) linkedContainer.classList.add('hidden');

      this.brandGuidelineRefreshBtn?.classList.remove('highlighted', 'hidden');
    }
  }

  showUpdateAvailable(serverData) {
    const indicator = document.getElementById('saveStatusIndicator');
    if (indicator) {
      indicator.querySelector('.save-status-text').textContent = 'Mudanças Identificadas';
      indicator.querySelector('.save-status-dot').style.background = 'var(--figma-color-bg-warning, #ff9800)';
    }

    if (this.brandGuidelineRefreshBtn) {
      this.brandGuidelineRefreshBtn.classList.remove('hidden');
      this.brandGuidelineRefreshBtn.classList.add('highlighted');
      this.brandGuidelineRefreshBtn.title = 'Sincronizar com as mudanças identificadas';
    }

    window.showToast?.('Mudanças encontradas na cloud. Clique em sincronizar.', 'info');
  }

  showSynchronized() {
    const indicator = document.getElementById('saveStatusIndicator');
    if (indicator) {
      indicator.querySelector('.save-status-text').textContent = 'Sincronizado';
      indicator.querySelector('.save-status-dot').style.background = '#1fa511';
    }

    if (this.brandGuidelineRefreshBtn) {
      this.brandGuidelineRefreshBtn.classList.remove('highlighted');
      this.brandGuidelineRefreshBtn.classList.add('hidden');
      this.brandGuidelineRefreshBtn.title = 'Busca atualizada';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DESIGN TOKENS METHODS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update a design token value
   */
  updateToken(category, key, value) {
    // Clone to avoid mutation
    const tokens = JSON.parse(JSON.stringify(state.designTokens || { spacing: {}, radius: {}, shadows: {} }));
    if (!tokens[category]) tokens[category] = {};
    tokens[category][key] = parseInt(value) || 0;
    setState('designTokens', tokens);
    // watchState auto-saves (debounced)
  }

  /**
   * Render token inputs from state
   */
  renderTokenInputs(tokens = {}) {
    this.tokenInputs.forEach(input => {
      const [category, key] = input.dataset.token.split('.');
      if (tokens[category]?.[key] !== undefined) {
        input.value = tokens[category][key];
      }
    });
  }

  /**
   * Get current tokens as object
   */
  getTokens() {
    const tokens = { spacing: {}, radius: {}, shadows: {} };
    this.tokenInputs.forEach(input => {
      const [category, key] = input.dataset.token.split('.');
      tokens[category][key] = parseInt(input.value) || 0;
    });
    return tokens;
  }

  // ═══════════════════════════════════════════════════════════════
  // UI COMPONENTS METHODS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Default component types
   */
  getDefaultComponentTypes() {
    return ['Button', 'Card', 'Input', 'Avatar', 'Badge'];
  }

  /**
   * Get all component types (default + custom)
   */
  getAllComponentTypes() {
    const defaults = this.getDefaultComponentTypes();
    const custom = state.customComponentTypes || [];
    return [...defaults, ...custom];
  }

  /**
   * Add a custom component type
   */
  addCustomComponent() {
    // Use selection if available, otherwise prompt for name
    parent.postMessage({ pluginMessage: { type: 'CAPTURE_COMPONENT_SELECTION' } }, '*');
    setState('activeComponentCapture', '__new__');
  }

  /**
   * Remove a custom component type
   */
  removeCustomComponent(type) {
    const custom = state.customComponentTypes || [];
    const updated = custom.filter(t => t !== type);
    setState('customComponentTypes', updated);

    // Also remove from selected components
    const components = state.selectedUIComponents || {};
    delete components[type];
    setState('selectedUIComponents', { ...components });

    this.renderComponentsGrid();
    // watchState auto-saves both customComponentTypes and selectedUIComponents
  }

  /**
   * Render UI components grid with lazy loading
   */
  renderComponentsGrid() {
    const grid = document.getElementById('componentsGrid');
    if (!grid) return;

    const allTypes = this.getAllComponentTypes();
    const selectedComponents = state.selectedUIComponents || {};
    const defaults = this.getDefaultComponentTypes();

    if (allTypes.length === 0) {
      grid.innerHTML = '<div class="text-muted" style="padding:12px">Nenhum componente configurado.</div>';
      return;
    }

    grid.innerHTML = '';

    // Lazy loading implementation: render in batches
    const BATCH_SIZE = 5;
    let currentIndex = 0;

    const renderBatch = () => {
      const fragment = document.createDocumentFragment();
      const end = Math.min(currentIndex + BATCH_SIZE, allTypes.length);

      for (let i = currentIndex; i < end; i++) {
        const type = allTypes[i];
        const typeKey = type.toLowerCase();
        const component = selectedComponents[typeKey];
        const isCustom = !defaults.includes(type);

        const row = document.createElement('div');
        row.className = 'component-selector-row';
        row.innerHTML = `
          <span class="figma-prop-label">${this.escapeHtml(type)}</span>
          <div class="component-value ${component ? 'has-value' : ''}" data-component="${typeKey}">
            ${component ? this.escapeHtml(component.name) : '—'}
          </div>
          <button class="figma-icon-btn component-capture-btn" data-component="${typeKey}" title="Usar seleção atual">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 1.5L9 5L6.5 6L8 9.5L7 10L5.5 6.5L4 8V1.5Z" fill="currentColor"/></svg>
          </button>
          ${isCustom ? `
          <button class="figma-icon-btn component-remove-btn" data-type="${type}" title="Remover tipo de componente">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          ` : ''}
        `;

        // Selection click
        row.querySelector('.component-value').addEventListener('click', () => {
          setState('activeModalTarget', `ui-component-${typeKey}`);
          this._openLibraryModal();
        });

        // Capture button
        row.querySelector('.component-capture-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.captureUIComponent(typeKey);
        });

        // Remove button (custom only)
        if (isCustom) {
          row.querySelector('.component-remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeCustomComponent(type);
          });
        }

        fragment.appendChild(row);
      }

      grid.appendChild(fragment);
      currentIndex = end;

      if (currentIndex < allTypes.length) {
        requestAnimationFrame(renderBatch);
      }
    };

    renderBatch();
  }

  /**
   * Capture current selection as UI component
   */
  captureUIComponent(type) {
    setState('activeComponentCapture', type);
    parent.postMessage({ pluginMessage: { type: 'CAPTURE_COMPONENT_SELECTION' } }, '*');
  }

  /**
   * Handle component capture result
   */
  handleComponentCaptured(component, explicitType = null) {
    const type = explicitType || state.activeComponentCapture;
    if (!type || !component) return;

    // If this is a new custom component, add the type first
    if (type === '__new__') {
      const typeName = component.name.split('/').pop().replace(/[-_]/g, ' ').trim();
      const capitalizedName = typeName.charAt(0).toUpperCase() + typeName.slice(1);

      const custom = state.customComponentTypes || [];
      if (!custom.includes(capitalizedName) && !this.getDefaultComponentTypes().includes(capitalizedName)) {
        custom.push(capitalizedName);
        setState('customComponentTypes', custom);
      }

      // Now set the component
      const components = state.selectedUIComponents || {};
      components[capitalizedName.toLowerCase()] = component;
      setState('selectedUIComponents', { ...components });
    } else {
      const components = state.selectedUIComponents || {};
      components[type] = component;
      setState('selectedUIComponents', { ...components });
    }

    setState('activeComponentCapture', null);
    this.renderComponentsGrid();
    // watchState auto-saves customComponentTypes and selectedUIComponents
  }
}

const brandModule = new BrandModule();
window.brandModule = brandModule;
