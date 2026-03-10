/**
 * UI Manager - Main coordinator for progressive disclosure and view management
 * Best practice: Central UI orchestration, mode switching, view routing
 */

class UIManager {
  constructor() {
    this.mainView = document.getElementById('mainView');
    this.settingsView = document.getElementById('settingsView');
    this.selectionIndicator = document.getElementById('selectionIndicator');

    // WebSocket management
    this.ws = null;
    this.wsReconnectAttempts = 0;
    this.wsMaxReconnectAttempts = 5;
    this.wsReconnectDelay = 5000; // 5 seconds

    this.setupEventListeners();
    this.setupStateListeners();
    this.setupSandboxListeners();
    this.initWebSocket();
  }

  setupEventListeners() {
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
        const modal = e.target.closest('.modal');
        if (modal) {
          modal.classList.add('hidden');
          setState('activeModalTarget', null);
        }
      });
    });

    // Close modals on outside click (covers component, font, operations modals)
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

    // Save Gemini API key
    document.getElementById('apiKeySaveBtn')?.addEventListener('click', () => {
      const key = document.getElementById('apiKeyInput')?.value || '';
      saveApiKey(key);
      setState('userApiKey', key);
    });

    // API Section toggle (Gemini)
    document.getElementById('apiSectionToggle')?.addEventListener('click', () => {
      const chevron = document.getElementById('apiChevron');
      const content = document.getElementById('apiContent');
      if (chevron && content) {
        chevron.classList.toggle('collapsed');
        content.classList.toggle('hidden');
      }
    });

    // API Section toggle (Anthropic)
    document.getElementById('anthropicSectionToggle')?.addEventListener('click', () => {
      const chevron = document.getElementById('anthropicChevron');
      const content = document.getElementById('anthropicContent');
      if (chevron && content) {
        chevron.classList.toggle('collapsed');
        content.classList.toggle('hidden');
      }
    });

    // Save Anthropic key
    document.getElementById('anthropicKeySaveBtn')?.addEventListener('click', () => {
      const key = document.getElementById('anthropicKeyInput')?.value || '';
      saveAnthropicKey(key);
      setState('anthropicApiKey', key);
      const status = document.getElementById('anthropicKeyStatus');
      if (status) {
        status.textContent = key ? '✅ Chave salva' : '🗑 Chave removida';
        setTimeout(() => { status.textContent = ''; }, 2000);
      }
    });

    // Listen for operations applied
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.focusChatInput();
      }
    });

    // Undo button
    document.getElementById('undoBtn')?.addEventListener('click', () => {
      parent.postMessage(
        { pluginMessage: { type: 'UNDO_LAST_BATCH' } },
        'https://www.figma.com'
      );
    });

    // Auth: Login button
    document.getElementById('authLoginBtn')?.addEventListener('click', async () => {
      const email = document.getElementById('authEmailInput')?.value || '';
      const password = document.getElementById('authPasswordInput')?.value || '';
      if (!email || !password) {
        const status = document.getElementById('authLoginStatus');
        if (status) status.textContent = '⚠ Preencha email e senha';
        return;
      }
      const btn = document.getElementById('authLoginBtn');
      if (btn) btn.textContent = 'Entrando...';
      const result = await authLogin(email, password);
      if (btn) btn.textContent = 'Entrar';
      if (!result.success) {
        const status = document.getElementById('authLoginStatus');
        if (status) status.textContent = `❌ ${result.error}`;
      }
    });

    // Auth: Logout button
    document.getElementById('authLogoutBtn')?.addEventListener('click', () => {
      logout();
    });

    // Auth: On token loaded from storage (on plugin init)
    eventBus.on('auth:login-success', () => {
      this.updateAuthUI(true);
    });
    eventBus.on('auth:logout', () => {
      this.updateAuthUI(false);
    });
    eventBus.on('auth:no-credits', (message) => {
      this.addSystemMessage(`⚠️ ${message}`);
    });

    // Load saved auth token on initialization
    loadAuthToken();
  }

  setupStateListeners() {
    // Selection changes
    watchState('selectionDetails', () => {
      this.updateSelectionIndicator();
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

    // Brand Guideline V2 sync
    window.watchState('brandGuideline', () => {
      if (window.brandSyncModule) window.brandSyncModule.scheduleSave()
    })
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
            // Default to logoLight when using selection-as-logo
            setState('logoLight', msg.component);
          } else {
            chatModule.addErrorMessage('⚠️ Selecione um componente ou instância para usar como logo.');
          }
          break;
        case 'ELEMENTS_FOR_MENTIONS':
          // Pass Figma elements to mentions module for autocomplete
          mentionsModule.handleFigmaElements({
            layers: msg.layers || [],
            frames: msg.frames || [],
            components: msg.components || [],
            variables: msg.variables || []
          });
          break;
        case 'GUIDELINES_LOADED':
          eventBus.emit('guidelines:loaded', msg.guidelines);
          break;
        case 'GUIDELINE_SAVED':
          eventBus.emit('guideline:saved', msg);
          break;
        case 'DESIGN_SYSTEM_LOADED':
          eventBus.emit('designSystem:loaded', msg.designSystem || null);
          break;
        case 'DESIGN_SYSTEM_SAVED':
          eventBus.emit('designSystem:loaded', msg.designSystem || null);
          break;
        case 'BRAND_GUIDELINE_LOADED':
        case 'BRAND_GUIDELINE_SAVED':
          if (window.brandSyncModule) window.brandSyncModule.handleMessage(msg)
          break;
        case 'API_KEY_LOADED':
          setState('userApiKey', msg.key || '');
          if (document.getElementById('apiKeyInput')) {
            document.getElementById('apiKeyInput').value = msg.key || '';
          }
          break;
        case 'ANTHROPIC_KEY_LOADED':
          setState('anthropicApiKey', msg.key || '');
          if (document.getElementById('anthropicKeyInput')) {
            document.getElementById('anthropicKeyInput').value = msg.key || '';
          }
          break;
        case 'AUTH_TOKEN_LOADED':
          if (msg.token) {
            setState('authToken', msg.token);
            // Fetch auth status from server to restore session
            fetchAuthStatus().then(data => {
              if (data.authenticated) {
                this.updateAuthUI(true);
              }
            });
          }
          break;
        case 'AUTH_TOKEN_SAVED':
          break;
        case 'CALL_API':
          this.callAPI(msg.context);
          break;
        case 'OPERATIONS_DONE':
          eventBus.emit('chat:loading', false);
          if (msg.summary) {
            chatModule.addAssistantMessage(`✅ ${msg.summary}`, msg.summaryItems);
          }
          this.toggleUndoBtn(!!msg.canUndo);
          break;
        case 'ERROR':
          eventBus.emit('chat:loading', false);
          chatModule.addErrorMessage(`⚠️ ${msg.message}`);
          break;

        // ── Undo Result ──
        case 'UNDO_RESULT':
          if (msg.success) {
            chatModule.addAssistantMessage(msg.message);
          } else {
            chatModule.addErrorMessage(msg.message);
          }
          this.toggleUndoBtn(!!msg.canUndo);
          break;

        // ── Image Generation Feedback ──
        case 'IMAGE_PASTED':
          chatModule.addAssistantMessage(msg.message || '✨ Imagem colada no canvas!');
          break;

        case 'IMAGE_PASTE_ERROR':
          chatModule.addErrorMessage(`❌ Erro ao colar imagem: ${msg.error}`);
          break;

        // ── Agent Operation Responses ──
        case 'OPERATION_ACK':
          // Operation applied successfully from agent
          console.log('[Plugin UI] Operation ACK:', msg.opId, 'applied', msg.appliedCount, 'ops');
          this.sendToServer({
            type: 'OPERATION_ACK',
            opId: msg.opId,
            success: true,
            appliedCount: msg.appliedCount,
          });
          break;

        case 'OPERATION_ERROR':
          // Operation failed in plugin
          console.error('[Plugin UI] Operation ERROR:', msg.opId, msg.error);
          this.sendToServer({
            type: 'OPERATION_ERROR',
            opId: msg.opId,
            error: msg.error,
          });
          break;

        case 'SELECTION_CHANGED':
          // User selection changed, forward to server
          this.sendToServer({
            type: 'SELECTION_CHANGED',
            nodes: msg.nodes || [],
          });
          break;

        // ── WebSocket Status ──
        case 'WS_OPEN':
          console.log('[Plugin UI] WebSocket opened');
          break;

        case 'WS_CLOSED':
          console.log('[Plugin UI] WebSocket closed');
          break;

        case 'WS_ERROR':
          console.error('[Plugin UI] WebSocket error:', msg.error);
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
    // Note: chat.js's api:design-generated handler owns all chat rendering (MESSAGE ops, status, loading).
    // Here we only need to call generateDesign (which emits the event) and apply design ops.
    try {
      const operations = await generateDesign(context.command, context);
      // generateDesign already emitted api:design-generated → chat.js handles display.
      // operations is [] if cancelled — no-op is correct here.
      // Now apply only the non-MESSAGE design operations to Figma:
      const designOps = (operations || []).filter(op => op.type !== 'MESSAGE');
      if (designOps.length > 0) {
        applyOperations(designOps);
      }
    } catch (_error) {
      // api:error event (emitted by apiCall) already handles the user-visible error message.
      // This catch only resets loading state as a safety net (e.g. for errors before apiCall).
      eventBus.emit('chat:loading', false);
      chatModule.removeTypingBubble();
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
   * Initialize WebSocket connection to server
   */
  initWebSocket() {
    // Get auth token (implement based on your auth strategy)
    const token = this.getPluginToken();
    const fileId = this.getFileId();

    if (!token || !fileId) {
      console.warn('[UIManager] Cannot initialize WebSocket: missing token or fileId');
      return;
    }

    const wsUrl = this.buildWebSocketUrl(token, fileId);
    console.log('[UIManager] Initializing WebSocket:', wsUrl.split('?')[0] + '?***');

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[UIManager] WebSocket connected');
        this.wsReconnectAttempts = 0;
        parent.postMessage(
          { pluginMessage: { type: 'WS_OPEN' } },
          '*'
        );
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (err) {
          console.error('[UIManager] Invalid JSON from server:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[UIManager] WebSocket error:', err);
        parent.postMessage(
          { pluginMessage: { type: 'WS_ERROR', error: err.message } },
          '*'
        );
      };

      this.ws.onclose = () => {
        console.log('[UIManager] WebSocket closed');
        parent.postMessage(
          { pluginMessage: { type: 'WS_CLOSED' } },
          '*'
        );

        // Attempt reconnect with exponential backoff
        if (this.wsReconnectAttempts < this.wsMaxReconnectAttempts) {
          this.wsReconnectAttempts++;
          const delay = this.wsReconnectDelay * this.wsReconnectAttempts;
          console.log(`[UIManager] Reconnecting in ${delay}ms (attempt ${this.wsReconnectAttempts})`);
          setTimeout(() => this.initWebSocket(), delay);
        } else {
          console.error('[UIManager] Max reconnect attempts reached');
        }
      };
    } catch (err) {
      console.error('[UIManager] Failed to create WebSocket:', err);
    }
  }

  /**
   * Get plugin authentication token
   */
  getPluginToken() {
    // TODO: Implement based on your auth strategy
    // For now, return a simple user ID
    const userId = localStorage.getItem('figmaPluginUserId') || 'plugin-user-' + Date.now();
    localStorage.setItem('figmaPluginUserId', userId);
    return userId + ':' + Date.now();
  }

  /**
   * Get current file ID
   */
  getFileId() {
    // This will be set by the plugin code
    return window.figmaFileId || 'unknown';
  }

  /**
   * Build WebSocket URL
   */
  buildWebSocketUrl(token, fileId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:3001';
    const params = new URLSearchParams({
      token,
      fileId,
    });
    return `${protocol}//${host}/api/plugin/ws?${params.toString()}`;
  }

  /**
   * Handle messages from server via WebSocket
   */
  handleWebSocketMessage(message) {
    const { type } = message;
    console.log('[UIManager] WebSocket message:', type);

    switch (type) {
      case 'PLUGIN_READY':
        console.log('[UIManager] Plugin ready for operations');
        break;

      case 'AGENT_OPS':
        // Forward agent operations to plugin sandbox
        parent.postMessage(
          {
            pluginMessage: {
              type: 'AGENT_OPS',
              operations: message.operations,
              opId: message.opId,
            },
          },
          '*'
        );
        break;

      default:
        console.warn('[UIManager] Unknown WebSocket message type:', type);
    }
  }

  /**
   * Send message to server via WebSocket
   */
  sendToServer(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[UIManager] WebSocket not connected, cannot send message:', message.type);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (err) {
      console.error('[UIManager] Failed to send WebSocket message:', err);
    }
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
   * Show/hide undo button based on whether there are undo entries
   */
  toggleUndoBtn(canUndo) {
    const btn = document.getElementById('undoBtn');
    if (btn) {
      btn.classList.toggle('hidden', !canUndo);
    }
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
   * Update auth UI (login form / logged-in state)
   */
  updateAuthUI(authenticated) {
    const loggedOut = document.getElementById('authLoggedOut');
    const loggedIn = document.getElementById('authLoggedIn');
    const emailEl = document.getElementById('authUserEmail');
    const tierEl = document.getElementById('authUserTier');
    const creditsEl = document.getElementById('authCreditsInfo');
    const statusEl = document.getElementById('authLoginStatus');

    if (authenticated && state.authEmail) {
      if (loggedOut) loggedOut.classList.add('hidden');
      if (loggedIn) loggedIn.classList.remove('hidden');
      if (emailEl) emailEl.textContent = state.authEmail;
      if (tierEl) {
        const tierLabels = { free: 'Free', premium: 'Premium', pro: 'Pro' };
        tierEl.textContent = tierLabels[state.credits.tier] || state.credits.tier;
      }
      if (creditsEl) {
        const c = state.credits;
        if (c.hasSubscription) {
          creditsEl.textContent = `${c.remaining} créditos restantes de ${c.total}`;
        } else {
          creditsEl.textContent = `${c.freeRemaining} gerações grátis restantes`;
        }
      }
      if (statusEl) statusEl.textContent = '';
    } else {
      if (loggedOut) loggedOut.classList.remove('hidden');
      if (loggedIn) loggedIn.classList.add('hidden');
    }
    this.updateCreditPill();
  }

  /**
   * Update credit pill in chat footer
   */
  updateCreditPill() {
    const pill = document.getElementById('creditPill');
    if (!pill) return;

    if (!state.authToken) {
      pill.classList.remove('visible', 'low', 'empty');
      return;
    }

    const c = state.credits;
    const display = c.hasSubscription ? c.remaining : c.freeRemaining;
    const label = c.hasSubscription ? `${display} créd.` : `${display} free`;

    pill.textContent = label;
    pill.classList.add('visible');
    pill.classList.remove('low', 'empty');

    if (display <= 0) {
      pill.classList.add('empty');
    } else if (display <= 3) {
      pill.classList.add('low');
    }
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    return escapeHtml(text);
  }
}

const uiManager = new UIManager();
