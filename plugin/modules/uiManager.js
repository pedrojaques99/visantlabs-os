/**
 * UI Manager - Main coordinator for progressive disclosure and view management
 * Best practice: Central UI orchestration, mode switching, view routing
 */

class UIManager {
  constructor() {
    this.mainView = document.getElementById('mainView');
    this.settingsView = document.getElementById('settingsView');
    this.modeToggle = document.getElementById('modeToggle');
    this.advancedPanel = document.getElementById('advancedPanel');
    this.operationsLog = document.getElementById('operationsLog');
    this.jsonPreview = document.getElementById('jsonPreview');
    this.selectionIndicator = document.getElementById('selectionIndicator');

    this.setupEventListeners();
    this.setupStateListeners();
    this.setupSandboxListeners();
  }

  setupEventListeners() {
    // Mode toggle (Simple vs Advanced)
    this.modeToggle?.addEventListener('change', (e) => {
      const newMode = e.target.checked ? 'advanced' : 'simple';
      setState('mode', newMode);
      // Persist mode preference
      eventBus.emit('api:save-mode', newMode);
    });

    // Tabs Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.target.getAttribute('data-tab');

        // Update active class on buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        // Update visibility of contents
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.remove('hidden');
      });
    });

    // Modals generic close
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
        setState('activeModalTarget', null);
      });
    });

    // Clicking outside modal content to close
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
          setState('activeModalTarget', null);
        }
      });
    });

    // Settings navigation
    document.getElementById('settingsBtn')?.addEventListener('click', () => {
      this.openSettings();
    });

    document.getElementById('settingsCloseBtn')?.addEventListener('click', () => {
      this.closeSettings();
    });

    // Clear chat button
    document.getElementById('clearChatBtn')?.addEventListener('click', () => {
      chatModule.clearHistory();
    });

    // Save API key
    document.getElementById('apiKeySaveBtn')?.addEventListener('click', () => {
      const key = document.getElementById('apiKeyInput')?.value || '';
      saveApiKey(key);
      setState('userApiKey', key);
    });

    // API Section toggle
    document.getElementById('apiSectionToggle')?.addEventListener('click', () => {
      const chevron = document.getElementById('apiChevron');
      const content = document.getElementById('apiContent');
      if (chevron && content) {
        chevron.classList.toggle('collapsed');
        content.classList.toggle('hidden');
      }
    });

    // Listen for operations applied
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.focusChatInput();
      }
    });
  }

  setupStateListeners() {
    // Mode change
    watchState('mode', (newMode) => {
      this.updateUIForMode(newMode);
    });

    // Selection changes
    watchState('selectionDetails', () => {
      this.updateSelectionIndicator();
    });

    // Operations ready
    eventBus.on('chat:operations-ready', (operations) => {
      this.showOperationsInAdvancedMode(operations);
    });

    // Context updates
    eventBus.on('context:updated', (data) => {
      this.updateContextInfo(data);
    });

    // Component selection from library
    eventBus.on('library:component-selected', (component) => {
      console.log('[Plugin UI] Component selected:', component.name);
      // Could be used for previewing, adding to canvas, etc.
    });
  }

  setupSandboxListeners() {
    // Handle messages from Figma sandbox
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      console.log('[Plugin UI] Received message:', msg.type);

      switch (msg.type) {
        case 'CONTEXT_UPDATED':
          this.handleContextUpdate(msg);
          break;
        case 'COMPONENTS_LOADED':
          eventBus.emit('context:components-loaded', msg.components);
          break;
        case 'COMPONENT_THUMBNAIL':
          eventBus.emit('component:thumbnail-loaded', {
            componentId: msg.componentId,
            thumbnail: msg.thumbnail,
          });
          break;
        case 'COLOR_VARIABLES_LOADED':
          eventBus.emit('context:colors-loaded', msg.colors);
          break;
        case 'FONT_VARIABLES_LOADED':
          eventBus.emit('context:fonts-loaded', msg.fonts);
          break;
        case 'AVAILABLE_FONTS_LOADED':
          eventBus.emit('context:available-fonts-loaded', msg.families);
          break;
        case 'SELECTION_THUMBNAIL':
          setState('selectionThumb', msg.thumbnail);
          this.updateSelectionIndicator();
          break;
        case 'SELECTION_AS_LOGO':
          if (msg.component) {
            setState('selectedLogo', msg.component);
          } else {
            chatModule.addErrorMessage('⚠️ Selecione um componente ou instância para usar como logo.');
          }
          break;
        case 'GUIDELINES_LOADED':
          eventBus.emit('guidelines:loaded', msg.guidelines);
          break;
        case 'GUIDELINE_SAVED':
          eventBus.emit('guideline:saved', msg);
          break;
        case 'API_KEY_LOADED':
          setState('userApiKey', msg.key || '');
          if (document.getElementById('apiKeyInput')) {
            document.getElementById('apiKeyInput').value = msg.key || '';
          }
          break;
        case 'CALL_API':
          this.callAPI(msg.context);
          break;
        case 'OPERATIONS_DONE':
          eventBus.emit('chat:loading', false);
          if (msg.summary) {
            chatModule.addAssistantMessage(`✅ ${msg.summary}`);
          }
          break;
        case 'ERROR':
          eventBus.emit('chat:loading', false);
          chatModule.addErrorMessage(`⚠️ ${msg.message}`);
          break;
      }
    };
  }

  /**
   * Handle context update from sandbox
   */
  handleContextUpdate(msg) {
    setState('selectionDetails', msg.selectionDetails || []);

    eventBus.emit('context:updated', {
      selectedElements: msg.selectedElements,
      componentsCount: msg.componentsCount,
      colorVariables: msg.colorVariables,
      fontVariables: msg.fontVariables,
    });
  }

  /**
   * Call API to generate operations
   */
  async callAPI(context) {
    try {
      eventBus.emit('chat:loading', true);
      const operations = await generateDesign(
        context.command,
        context
      );

      if (operations && operations.length > 0) {
        // Extract text messages from conversational operations
        const messages = operations.filter(op => op.type === 'MESSAGE');
        const designOps = operations.filter(op => op.type !== 'MESSAGE');

        // Display textual responses
        if (messages.length > 0) {
          messages.forEach(msg => {
            chatModule.addAssistantMessage(msg.content);
          });
        }

        if (designOps.length > 0) {
          applyOperations(designOps);
        } else {
          // If there were only conversational messages and no design operations
          eventBus.emit('chat:loading', false);
        }
      } else {
        chatModule.addErrorMessage('❌ Nenhuma operação gerada. Tente ser mais específico.');
        eventBus.emit('chat:loading', false);
      }
    } catch (error) {
      chatModule.addErrorMessage(`❌ Erro ao gerar design: ${error.message}`);
      eventBus.emit('chat:loading', false);
    }
  }

  /**
   * Update UI based on mode
   */
  updateUIForMode(mode) {
    if (this.advancedPanel) {
      this.advancedPanel.classList.toggle('hidden', mode === 'simple');
    }

    if (this.modeToggle) {
      this.modeToggle.checked = mode === 'advanced';
    }
  }

  /**
   * Show operations in advanced mode
   */
  showOperationsInAdvancedMode(operations) {
    if (this.operationsLog) {
      this.operationsLog.innerHTML = `
        <div class="operations-header">Operações Geradas (${operations.length})</div>
        <div class="operations-list">
          ${operations
          .map(
            (op, i) => `
            <div class="operation-item">
              <span class="op-number">${i + 1}</span>
              <span class="op-type">${this.escapeHtml(op.type)}</span>
              ${op.props?.name ? `<span class="op-name">${this.escapeHtml(op.props.name)}</span>` : ''}
            </div>
          `
          )
          .join('')}
        </div>
      `;
    }

    if (this.jsonPreview) {
      this.jsonPreview.innerHTML = `<pre>${this.escapeHtml(JSON.stringify(operations, null, 2))}</pre>`;
    }
  }

  /**
   * Update selection indicator
   */
  updateSelectionIndicator() {
    if (!this.selectionIndicator) return;

    const selection = state.selectionDetails;
    if (selection.length === 0) {
      this.selectionIndicator.classList.add('hidden');
      return;
    }

    this.selectionIndicator.classList.remove('hidden');

    if (selection.length === 1) {
      const sel = selection[0];
      const icon = this.getNodeTypeIcon(sel.type);
      const thumb = state.selectionThumb;
      const thumbHtml = thumb
        ? `<img class="sel-thumb" src="${thumb}" alt="">`
        : `<div class="sel-icon">${icon}</div>`;

      this.selectionIndicator.innerHTML = `
        ${thumbHtml}
        <div class="sel-info">
          <div class="sel-name" title="${this.escapeHtml(sel.name)}">${this.escapeHtml(sel.name)}</div>
          <div class="sel-type">${this.getNodeTypeLabel(sel.type)}</div>
        </div>
      `;
    } else {
      const names = selection.map((s) => s.name).join(', ');
      this.selectionIndicator.innerHTML = `
        <div class="sel-icon">${selection.length}</div>
        <div class="sel-info">
          <div class="sel-multi">${selection.length} camadas selecionadas</div>
          <div class="sel-type sel-multi-list" title="${this.escapeHtml(names)}">${this.escapeHtml(names)}</div>
        </div>
      `;
    }
  }

  /**
   * Update context info
   */
  updateContextInfo(data) {
    const contextInfo = document.getElementById('contextInfo');
    if (!contextInfo) return;

    const items = [];
    if (data.selectedElements > 0)
      items.push(`📍 ${data.selectedElements} elemento(s) selecionado(s)`);
    if (data.componentsCount > 0) items.push(`◇ ${data.componentsCount} componentes`);
    if (data.colorVariables > 0) items.push(`🎨 ${data.colorVariables} cores`);
    if (data.fontVariables > 0) items.push(`🔤 ${data.fontVariables} fontes`);

    contextInfo.innerHTML = items.join(' • ') || 'Arquivo carregado';
  }

  /**
   * Open settings view
   */
  openSettings() {
    this.mainView?.classList.add('hidden');
    this.settingsView?.classList.remove('hidden');
    brandModule.updateBrandPill();
  }

  /**
   * Close settings view
   */
  closeSettings() {
    this.settingsView?.classList.add('hidden');
    this.mainView?.classList.remove('hidden');
    brandModule.updateBrandPill();
  }

  /**
   * Focus chat input
   */
  focusChatInput() {
    document.getElementById('chatInput')?.focus();
  }

  /**
   * Get node type icon
   */
  getNodeTypeIcon(type) {
    const icons = {
      FRAME: '▢',
      GROUP: '▧',
      COMPONENT: '◇',
      COMPONENT_SET: '◈',
      INSTANCE: '◆',
      TEXT: 'T',
      RECTANGLE: '■',
      ELLIPSE: '●',
      VECTOR: '✦',
      LINE: '─',
      BOOLEAN_OPERATION: '⊞',
      SECTION: '§',
    };
    return icons[type] || '□';
  }

  /**
   * Get node type label
   */
  getNodeTypeLabel(type) {
    const labels = {
      FRAME: 'Frame',
      GROUP: 'Grupo',
      COMPONENT: 'Componente',
      COMPONENT_SET: 'Component Set',
      INSTANCE: 'Instância',
      TEXT: 'Texto',
      RECTANGLE: 'Retângulo',
      ELLIPSE: 'Elipse',
      VECTOR: 'Vetor',
      LINE: 'Linha',
      BOOLEAN_OPERATION: 'Boolean',
      SECTION: 'Seção',
    };
    return labels[type] || type;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

const uiManager = new UIManager();
