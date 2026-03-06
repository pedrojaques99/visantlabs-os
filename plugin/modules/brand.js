/**
 * Brand module - Handle brand guidelines, logos, colors, fonts
 * Best practice: Isolated brand management logic
 */

class BrandModule {
  constructor() {
    this.brandPill = document.getElementById('brandPill');
    this.colorGrid = document.getElementById('colorGrid');
    this.fontList = document.getElementById('fontList');
    this.guidelineSelect = document.getElementById('guidelineSelect');

    this.setupEventListeners();
    this.setupStateListeners();
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

    // Color management
    document.getElementById('colorAddBtn')?.addEventListener('click', () => {
      const list = document.getElementById('availableColorsList');
      if (list) {
        list.classList.toggle('hidden');
        if (!list.classList.contains('hidden')) {
          this.renderAvailableColors();
        }
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
  }

  setupStateListeners() {
    watchState('logoLight', () => { this.renderLogos(); this.updateBrandPill(); });
    watchState('logoDark', () => { this.renderLogos(); this.updateBrandPill(); });
    watchState('logoAccent', () => { this.renderLogos(); this.updateBrandPill(); });

    watchState('fontPrimary', () => { this.renderFonts(); this.updateBrandPill(); });
    watchState('fontSecondary', () => { this.renderFonts(); this.updateBrandPill(); });

    watchState('selectedColors', () => {
      this.renderColorGrid();
      this.updateBrandPill();
    });

    watchState('savedGuidelines', () => {
      this.renderGuidelinesSelector();
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

    // Listen for component selection from the modal (via library module)
    eventBus.on('library:component-selected', (component) => {
      const target = state.activeModalTarget;
      if (['logoLight', 'logoDark', 'logoAccent'].includes(target)) {
        setState(target, component);
        document.getElementById('componentModal')?.classList.add('hidden');
        setState('activeModalTarget', null);
      }
    });
  }

  loadInitialData() {
    // Request initial data from sandbox
    getContext();
    loadGuidelines();
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
   * Render selected logos
   */
  renderLogos() {
    const fields = ['logoLight', 'logoDark', 'logoAccent'];

    fields.forEach(field => {
      const infoEl = document.getElementById(`${field}Info`);
      if (!infoEl) return;

      const val = state[field];
      if (val) {
        infoEl.innerHTML = `
          <div class="brand-item">
            <div class="brand-label">${this.escapeHtml(val.name)}</div>
            <button class="btn-small clear-logo-btn" data-target="${field}">Remover</button>
          </div>
        `;
      } else {
        infoEl.innerHTML = '<div class="text-muted">Não selecionado</div>';
      }
    });

    // Bind remove buttons
    document.querySelectorAll('.clear-logo-btn').forEach(btn => {
      btn.onclick = (e) => {
        const target = e.target.getAttribute('data-target');
        setState(target, null);
      };
    });
  }

  /**
   * Render selected fonts
   */
  renderFonts() {
    const fields = ['fontPrimary', 'fontSecondary'];

    fields.forEach(field => {
      const infoEl = document.getElementById(`${field}Info`);
      if (!infoEl) return;

      const val = state[field];
      if (val) {
        infoEl.innerHTML = `
          <div class="brand-item">
            <div class="brand-label">${this.escapeHtml(val.name)}</div>
            <button class="btn-small clear-font-btn" data-target="${field}">Remover</button>
          </div>
        `;
      } else {
        infoEl.innerHTML = '<div class="text-muted">Não selecionado</div>';
      }
    });

    // Bind remove buttons
    document.querySelectorAll('.clear-font-btn').forEach(btn => {
      btn.onclick = (e) => {
        const target = e.target.getAttribute('data-target');
        setState(target, null);
      };
    });
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

    this.colorGrid.innerHTML = '';
    for (const [id, color] of state.selectedColors) {
      const div = document.createElement('div');
      div.className = 'color-item';
      div.innerHTML = `
        <div class="color-swatch" style="background: ${color.value}" title="${this.escapeHtml(color.name)}"></div>
        <div class="color-name">${this.escapeHtml(color.name)}</div>
        <button class="btn-remove" data-color-id="${id}">×</button>
      `;

      div.querySelector('.btn-remove').addEventListener('click', () => {
        const newColors = new Map(state.selectedColors);
        newColors.delete(id);
        setState('selectedColors', newColors);
      });

      this.colorGrid.appendChild(div);
    }
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

    if (state.allFonts.length === 0) {
      this.fontList.innerHTML = '<div class="text-muted">Nenhuma fonte variável encontrada</div>';
      return;
    }

    this.fontList.innerHTML = '';
    for (const font of state.allFonts) {
      const div = document.createElement('div');
      div.className = 'font-item clickable';
      div.textContent = this.escapeHtml(font.name);

      div.addEventListener('click', () => {
        const target = state.activeModalTarget || 'fontPrimary';
        setState(target, font);
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
      if (guideline.logoLight) setState('logoLight', guideline.logoLight);
      if (guideline.logoDark) setState('logoDark', guideline.logoDark);
      if (guideline.logoAccent) setState('logoAccent', guideline.logoAccent);

      if (guideline.fontPrimary) setState('fontPrimary', guideline.fontPrimary);
      if (guideline.fontSecondary) setState('fontSecondary', guideline.fontSecondary);

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
      logoLight: state.logoLight,
      logoDark: state.logoDark,
      logoAccent: state.logoAccent,
      fontPrimary: state.fontPrimary,
      fontSecondary: state.fontSecondary,
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
}

const brandModule = new BrandModule();
