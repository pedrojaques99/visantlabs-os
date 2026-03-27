/**
 * Brand module - Handle brand guidelines, logos, colors, fonts, tokens, components
 * Best practice: Isolated brand management logic
 */

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

    this.setupEventListeners();
    this.setupStateListeners();
    this.setupCollapsibles();
    this.loadInitialData();
  }

  setupEventListeners() {
    // Brand pill click - open settings
    this.brandPill?.addEventListener('click', () => {
      const settingsBtn = document.getElementById('settingsBtn');
      if (settingsBtn) settingsBtn.click();
    });

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

    // Logo Buttons (open modal)
    document.querySelectorAll('.brand-select-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-target');
        setState('activeModalTarget', target);
        document.getElementById('componentModal')?.classList.remove('hidden');
      });
    });

    // Color management - show add row
    document.getElementById('colorAddBtn')?.addEventListener('click', () => {
      const addRow = document.getElementById('colorAddRow');
      if (addRow) {
        // Toggle add row and make sure library list is hidden
        const isHidden = addRow.classList.contains('hidden');
        if (isHidden) {
          addRow.classList.remove('hidden');
          this.availableColorsList?.classList.add('hidden');
          document.getElementById('colorNameInput')?.focus();
        } else {
          addRow.classList.add('hidden');
        }
      }
    });

    // Color library toggle
    document.getElementById('colorImportBtn')?.addEventListener('click', () => {
      if (this.availableColorsList) {
        // Toggle library list and make sure add row is hidden
        const isHidden = this.availableColorsList.classList.contains('hidden');
        if (isHidden) {
          this.availableColorsList.classList.remove('hidden');
          document.getElementById('colorAddRow')?.classList.add('hidden');
          // Refresh data if empty
          if (!state.allColors || state.allColors.length === 0) {
            getContext();
          } else {
            this.renderAvailableColors();
          }
        } else {
          this.availableColorsList.classList.add('hidden');
        }
      }
    });

    // Color confirm
    document.getElementById('colorConfirmBtn')?.addEventListener('click', () => {
      this.addManualColor();
    });

    // Color cancel
    document.getElementById('colorCancelBtn')?.addEventListener('click', () => {
      document.getElementById('colorAddRow')?.classList.add('hidden');
    });

    // Color name input - enter to confirm
    document.getElementById('colorNameInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.addManualColor();
      if (e.key === 'Escape') document.getElementById('colorAddRow')?.classList.add('hidden');
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

    // ═══ BRAND GUIDELINE API ═══
    this.brandGuidelineSelect?.addEventListener('change', (e) => {
      this.linkBrandGuideline(e.target.value);
    });

    this.brandGuidelineRefreshBtn?.addEventListener('click', () => {
      this.fetchBrandGuidelines();
    });

    document.getElementById('brandGuidelineAddBtn')?.addEventListener('click', () => {
      this.createNewGuideline();
    });

    document.getElementById('brandGuidelineOpenBtn')?.addEventListener('click', () => {
      this.openGuidelineInWebapp();
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
      document.getElementById('componentModal')?.classList.remove('hidden');
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


    // Font search
    this.fontSearch?.addEventListener('input', () => {
      this.renderFontList();
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

    watchState('selectedColors', () => {
      this.renderColorGrid();
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
      'selectedUIComponents', 'customComponentTypes'
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
          setState('typography', [
            { id: 'primary', label: 'Primary', value: config.fontPrimary },
            { id: 'secondary', label: 'Secondary', value: config.fontSecondary }
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
          const openBtn = document.getElementById('brandGuidelineOpenBtn');
          if (openBtn) openBtn.style.display = 'flex';
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
      this.renderComponentSelects(components);
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

  /**
   * Update brand pill indicator
   */
  updateBrandPill() {
    const isConfigured = isBrandConfigured();
    this.brandPill?.classList.toggle('active', isConfigured);

    const summary = getBrandSummary();
    if (summary) {
      this.brandPill.title = summary;
    }
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
      row.className = 'figma-prop-row';

      const val = logo.value;
      const isConfigured = !!val;

      row.innerHTML = `
        <input type="text" class="figma-prop-label-editable" value="${this.escapeHtml(logo.label)}" data-index="${index}" title="Renomear propriedade" />
        <div class="figma-prop-value ${isConfigured ? '' : 'text-muted'}" style="flex: 1; min-width: 0;">
          ${isConfigured ? (val.thumbnail ? `<img src="${val.thumbnail}" class="brand-item-thumb" alt="">` : '<div class="brand-item-icon">◇</div>') : 'Não selecionado'}
          ${isConfigured ? `<div class="brand-label" title="${this.escapeHtml(val.name)}">${this.escapeHtml(val.name)}</div>` : ''}
        </div>
        <div class="row-actions" style="display: flex; gap: 2px;">
          ${isConfigured ? `
            <button class="figma-icon-btn btn-remove-item" data-index="${index}" title="Limpar valor">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
          ` : ''}
          <button class="figma-icon-btn logo-capture-btn" data-index="${index}" title="Usar seleção atual">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 1.5L9 5L6.5 6L8 9.5L7 10L5.5 6.5L4 8V1.5Z" fill="currentColor"/></svg>
          </button>
          <button class="figma-icon-btn logo-select-btn" data-index="${index}" title="Escolher da Biblioteca">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.5 5.5V1h-1v4.5H1v1h4.5V11h1V6.5H11v-1H6.5z" fill="currentColor" /></svg>
          </button>
          ${state.logos.length > 1 ? `
            <button class="figma-icon-btn logo-remove-prop-btn" data-index="${index}" title="Remover propriedade">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.5"/></svg>
            </button>
          ` : ''}
        </div>
      `;

      // Label Edit
      row.querySelector('.figma-prop-label-editable').addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        const updatedLogos = [...state.logos];
        updatedLogos[idx].label = e.target.value;
        setState('logos', updatedLogos);
      });

      // Clear Value
      row.querySelector('.btn-remove-item')?.addEventListener('click', () => {
        const idx = index;
        const updatedLogos = [...state.logos];
        updatedLogos[idx].value = null;
        setState('logos', updatedLogos);
      });

      // Capture Selection
      row.querySelector('.logo-capture-btn').addEventListener('click', () => {
        setState('activeModalTarget', `logo-${index}`);
        parent.postMessage({ pluginMessage: { type: 'USE_SELECTION_AS_LOGO' } }, '*');
      });

      // Select Library
      row.querySelector('.logo-select-btn').addEventListener('click', () => {
        setState('activeModalTarget', `logo-${index}`);
        document.getElementById('componentModal')?.classList.remove('hidden');
      });

      // Remove Property
      row.querySelector('.logo-remove-prop-btn')?.addEventListener('click', () => {
        this.removeLogoProperty(index);
      });

      list.appendChild(row);
    });
  }

  /**
   * Render dynamic typography
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

      row.innerHTML = `
        <input type="text" class="figma-prop-label-editable" value="${this.escapeHtml(font.label)}" data-index="${index}" title="Renomear propriedade" />
        <div class="figma-prop-value ${isConfigured ? '' : 'text-muted'}" style="flex: 1; min-width: 0;">
          ${isConfigured ? `<div class="brand-label" title="${this.escapeHtml(val.name)}">${this.escapeHtml(val.name)}</div>` : 'Não selecionado'}
        </div>
        <div class="row-actions" style="display: flex; gap: 2px;">
          ${isConfigured ? `
            <button class="figma-icon-btn btn-remove-item" data-index="${index}" title="Limpar valor">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
          ` : ''}
          <button class="figma-icon-btn font-capture-btn" data-index="${index}" title="Usar seleção atual">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 1.5L9 5L6.5 6L8 9.5L7 10L5.5 6.5L4 8V1.5Z" fill="currentColor"/></svg>
          </button>
          <button class="figma-icon-btn font-select-btn" data-index="${index}" title="Escolher da Biblioteca">
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
        const idx = index;
        const updatedTypo = [...state.typography];
        updatedTypo[idx].value = null;
        setState('typography', updatedTypo);
      });

      // Capture Selection
      row.querySelector('.font-capture-btn').addEventListener('click', () => {
        setState('activeModalTarget', `font-${index}`);
        parent.postMessage({ pluginMessage: { type: 'USE_SELECTION_AS_FONT' } }, '*');
      });

      // Select Library
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
      updatedLogos[index].value = logo;
      setState('logos', updatedLogos);
    }
    setState('activeModalTarget', null);
  }

  /**
   * Handle captured font from sandbox
   */
  handleFontCaptured(font) {
    const target = state.activeModalTarget;
    if (!target || !target.startsWith('font-')) return;
    const index = parseInt(target.split('-')[1]);
    const updatedTypo = [...state.typography];
    if (updatedTypo[index]) {
      updatedTypo[index].value = font;
      setState('typography', updatedTypo);
    }
    setState('activeModalTarget', null);
  }

  /**
   * Render color grid
   */
  renderColorGrid() {
    if (!this.colorGrid) return;

    if (state.selectedColors.size === 0) {
      this.colorGrid.innerHTML = '<div class="text-muted">Nenhuma cor selecionada</div>';
      return;
    }

    const roles = [
      { id: '', label: 'Nenhuma' },
      { id: 'primary', label: 'Primária' },
      { id: 'secondary', label: 'Secundária' },
      { id: 'accent', label: 'Destaque' },
      { id: 'background', label: 'Fundo' },
      { id: 'surface', label: 'Superfície' },
      { id: 'text', label: 'Texto' }
    ];

    this.colorGrid.innerHTML = '';
    for (const [id, color] of state.selectedColors) {
      const div = document.createElement('div');
      div.className = 'color-item-row';
      
      const roleOptions = roles.map(r => 
        `<option value="${r.id}" ${color.role === r.id ? 'selected' : ''}>${r.label}</option>`
      ).join('');

      div.innerHTML = `
        <div class="color-swatch-small" style="background: ${color.value}"></div>
        <div class="color-info-group">
          <div class="color-name-label" title="${this.escapeHtml(color.name)}">${this.escapeHtml(color.name)}</div>
          <select class="color-role-select" data-color-id="${id}">
            ${roleOptions}
          </select>
        </div>
        <button class="figma-icon-btn btn-remove-color" data-color-id="${id}" title="Remover cor">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 3H3.5V9.5C3.5 9.77614 3.72386 10 4 10H8C8.27614 10 8.5 9.77614 8.5 9.5V3H9.5V2H7V1.5C7 1.22386 6.77614 1 6.5 1H5.5C5.22386 1 5 1.22386 5 1.5V2H2.5V3ZM6 2H5V3H7V2H6ZM4.5 4H5.5V9H4.5V4ZM6.5 4H7.5V9H6.5V4Z" fill="currentColor"/>
          </svg>
        </button>
      `;

      // Handle Role change (watchState auto-saves)
      div.querySelector('.color-role-select').addEventListener('change', (e) => {
        const newColors = new Map(state.selectedColors);
        const colorData = newColors.get(id);
        if (colorData) {
          colorData.role = e.target.value;
          setState('selectedColors', newColors);
        }
      });

      // Handle Remove (watchState auto-saves)
      div.querySelector('.btn-remove-color').addEventListener('click', () => {
        const newColors = new Map(state.selectedColors);
        newColors.delete(id);
        setState('selectedColors', newColors);
      });

      this.colorGrid.appendChild(div);
    }
  }

  /**
   * Add a color manually via color picker
   */
  addManualColor() {
    const colorInput = document.getElementById('colorPickerInput');
    const nameInput = document.getElementById('colorNameInput');
    const addRow = document.getElementById('colorAddRow');

    const hex = colorInput?.value || '#6366F1';
    const name = nameInput?.value?.trim() || hex;

    const colorId = `manual-${Date.now()}`;
    const newColors = new Map(state.selectedColors);
    newColors.set(colorId, {
      id: colorId,
      name: name,
      value: hex,
      role: ''
    });

    setState('selectedColors', newColors);
    // watchState auto-saves

    // Reset and hide
    if (nameInput) nameInput.value = '';
    addRow?.classList.add('hidden');
  }

  /**
   * Render available colors for selection
   */
  renderAvailableColors() {
    const colorList = document.getElementById('availableColorsList');
    if (!colorList) return;

    colorList.innerHTML = '';
    for (const color of state.allColors) {
      const div = document.createElement('div');
      div.className = 'color-item clickable';
      div.innerHTML = `
        <div class="color-swatch" style="background: ${color.value}" title="${this.escapeHtml(color.name)}"></div>
        <div class="color-name">${this.escapeHtml(color.name)}</div>
      `;

      div.addEventListener('click', () => {
        const newColors = new Map(state.selectedColors);
        newColors.set(color.id, color);
        setState('selectedColors', newColors);
      });

      colorList.appendChild(div);
    }
  }

  /**
   * Render font list
   */
  renderFontList() {
    if (!this.fontList) return;

    const query = this.fontSearch?.value.toLowerCase() || '';
    const filteredFonts = state.allFonts.filter(f => 
      f.name.toLowerCase().includes(query) || 
      (f.family && f.family.toLowerCase().includes(query)) ||
      (f.style && f.style.toLowerCase().includes(query))
    );

    if (filteredFonts.length === 0) {
      if (query) {
        this.fontList.innerHTML = '<div class="text-muted">Nenhuma fonte corresponde à busca</div>';
      } else {
        this.fontList.innerHTML = '<div class="text-muted">Nenhuma fonte variável encontrada</div>';
      }
      return;
    }

    this.fontList.innerHTML = '';
    for (const font of filteredFonts) {
      const div = document.createElement('div');
      div.className = 'font-item clickable';
      
      const familyHtml = font.family ? `<strong>${this.escapeHtml(font.family)}</strong>` : this.escapeHtml(font.name);
      const styleHtml = font.style ? `<span class="text-muted" style="margin-left: 6px; font-size: 10px;">${this.escapeHtml(font.style)}</span>` : '';
      
      div.innerHTML = `${familyHtml}${styleHtml}`;

      div.addEventListener('click', () => {
        const target = state.activeModalTarget || 'font-0'; // Default to first
        this.handleFontCaptured(font);
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
        setState('typography', [
          { id: 'primary', label: 'Primary', value: guideline.fontPrimary },
          { id: 'secondary', label: 'Secondary', value: guideline.fontSecondary }
        ]);
      }

      if (guideline.colors) {
        const colors = new Map();
        for (const c of guideline.colors) {
          colors.set(c.id, c);
        }
        setState('selectedColors', colors);
      }
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
    const openBtn = document.getElementById('brandGuidelineOpenBtn');
    if (linkedId) {
      this.brandGuidelineSelect.value = linkedId;
      if (openBtn) openBtn.style.display = 'flex';
    } else {
      if (openBtn) openBtn.style.display = 'none';
    }
  }

  /**
   * Link a brand guideline from API via brandSyncModule
   */
  async linkBrandGuideline(guidelineId) {
    const openBtn = document.getElementById('brandGuidelineOpenBtn');

    if (!guidelineId) {
      // Unlink
      setState('linkedGuidelineId', null);
      setState('linkedGuideline', null);
      setState('brandGuideline', null);
      this.updateBrandGuidelineStatus(null);
      if (openBtn) openBtn.style.display = 'none';
      parent.postMessage({ pluginMessage: { type: 'LINK_GUIDELINE', guidelineId: null } }, '*');
      return;
    }

    if (!window.brandSyncModule) return;

    // Use brandSyncModule.select() which handles caching and state
    const guideline = await window.brandSyncModule.select(guidelineId);
    if (guideline) {
      setState('linkedGuidelineId', guidelineId);
      setState('linkedGuideline', guideline);

      // Auto-populate colors, typography, tokens
      this.applyGuidelineToState(guideline);
      this.updateBrandGuidelineStatus(guideline);

      // Show open button
      if (openBtn) openBtn.style.display = 'flex';

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
    const webappUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? `http://localhost:5173/brand-guidelines?id=${guidelineId}`
      : `https://www.visantlabs.com/brand-guidelines?id=${guidelineId}`;
    window.open(webappUrl, '_blank');
  }

  /**
   * Apply guideline data to current state
   */
  applyGuidelineToState(guideline) {
    if (!guideline) return;

    // Colors
    if (guideline.colors?.length) {
      const colorMap = new Map();
      guideline.colors.forEach((c, i) => {
        colorMap.set(`api-color-${i}`, {
          name: c.name,
          value: c.hex,
          role: c.role || ''
        });
      });
      setState('selectedColors', colorMap);
    }

    // Typography (map to first two)
    if (guideline.typography?.length) {
      setState('typography', guideline.typography.map((t, i) => ({
        id: t.id || `font-${i}`,
        label: t.role || (i === 0 ? 'Primary' : 'Secondary'),
        value: { id: t.family, name: `${t.family} ${t.style || ''}`.trim() }
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
    if (!this.brandGuidelineStatus) return;

    if (guideline) {
      this.brandGuidelineStatus.style.display = 'flex';
      this.brandGuidelineStatus.classList.add('linked');
      this.brandGuidelineStatus.querySelector('.status-text').textContent =
        `Vinculado: ${guideline.identity?.name || 'Marca'}`;
    } else {
      this.brandGuidelineStatus.style.display = 'none';
      this.brandGuidelineStatus.classList.remove('linked');
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
          document.getElementById('componentModal')?.classList.remove('hidden');
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
