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
    
    // Initial fetch for session and state
    this.init();
  }

  /**
   * Initialize plugin state and restore session
   */
  init() {
    loadAuthToken();
    loadApiKey();
    loadAnthropicKey();
    getContext();
    loadGuidelines();
    loadDesignSystem();
    
    // Request local brand config
    parent.postMessage({ pluginMessage: { type: 'GET_LOCAL_BRAND_CONFIG' } }, '*');
  }

  handleUserInfo(user) {
    if (!user) return;
    setState('currentUser', user);
    this.renderUserAvatar(user);
  }

  renderUserAvatar(user) {
    const avatarEl = document.getElementById('userAvatar');
    if (!avatarEl) return;

    if (user.photoUrl) {
      avatarEl.innerHTML = `<img src="${user.photoUrl}" alt="${user.name}">`;
      avatarEl.classList.add('has-photo');
    } else {
      // Initials fallback
      const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      avatarEl.textContent = initials;
      avatarEl.classList.remove('has-photo');
    }

    avatarEl.title = `Conectado como ${user.name}`;
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

    // Clear chat button (settings)
    document.getElementById('clearChatBtn')?.addEventListener('click', () => {
      chatModule.clearHistory();
    });

    // Clear session button (header)
    document.getElementById('clearSessionBtn')?.addEventListener('click', () => {
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
      const rememberMe = document.getElementById('authRememberMe')?.checked ?? true;
      const status = document.getElementById('authLoginStatus');
      const btn = document.getElementById('authLoginBtn');
      
      if (!email || !password) {
        if (status) {
          status.innerHTML = '<span style="color: var(--figma-color-text-danger);">⚠ Preencha email e senha</span>';
        }
        return;
      }

      if (btn) {
        btn.classList.add('loading');
        btn.disabled = true;
      }
      
      if (status) status.textContent = 'Autenticando...';

      try {
        const result = await authLogin(email, password, rememberMe);
        if (!result.success) {
          if (status) {
            status.innerHTML = `<span style="color: var(--figma-color-text-danger);">❌ ${result.error}</span>`;
          }
        } else {
          if (status) status.textContent = '';
        }
      } catch (err) {
        if (status) {
          status.innerHTML = `<span style="color: var(--figma-color-text-danger);">❌ ${err.message}</span>`;
        }
      } finally {
        if (btn) {
          btn.classList.remove('loading');
          btn.disabled = false;
        }
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
    eventBus.on('auth:session-expired', (data) => {
      this.updateAuthUI(false);
      const statusEl = document.getElementById('authLoginStatus');
      if (statusEl) {
        statusEl.textContent = `⚠️ ${data?.reason || 'Sessão expirada. Faça login novamente.'}`;
      }
      this.addSystemMessage('⚠️ Sua sessão expirou. Faça login novamente na aba Settings.');
    });
    eventBus.on('auth:rate-limited', (data) => {
      this.addSystemMessage(`⏳ ${data?.error || 'Muitas tentativas. Aguarde alguns minutos.'}`);
    });
    eventBus.on('auth:login-error', (message) => {
      const statusEl = document.getElementById('authLoginStatus');
      if (statusEl) {
        statusEl.textContent = `❌ ${message || 'Erro ao fazer login'}`;
      }
    });
  }

  setupStateListeners() {
    // Selection changes
    watchState('selectionDetails', () => {
      this.updateSelectionIndicator();
    });

    // Handle user info from state if needed (or direct from message)
    watchState('currentUser', (user) => {
      if (user) this.renderUserAvatar(user);
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
        case 'SELECTION_LOGO_RESULT':
          if (msg.component) {
            eventBus.emit('selection:logo-result', msg.component);
          } else {
            chatModule.addErrorMessage('⚠️ Selecione um componente ou instância para usar como logo.');
            eventBus.emit('selection:logo-result', null);
          }
          break;
        case 'SELECTION_FONT_RESULT':
          if (msg.font) {
            eventBus.emit('selection:font-result', msg.font);
          } else {
            chatModule.addErrorMessage('⚠️ Selecione um nó de texto para capturar a fonte.');
            eventBus.emit('selection:font-result', null);
          }
          break;
        case 'SELECTION_AS_LOGO': // Legacy fallback
          if (msg.component) {
            setState('logoLight', msg.component);
          }
          break;
        case 'COMPONENT_CAPTURED':
          eventBus.emit('selection:component-captured', msg.component);
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
        case 'USER_INFO':
          this.handleUserInfo(msg.user);
          break;
        case 'API_KEY_LOADED':
          setState('userApiKey', msg.key || '');
          if (document.getElementById('apiKeyInput')) {
            document.getElementById('apiKeyInput').value = msg.key || '';
          }
          break;
        case 'LOCAL_BRAND_LOADED':
          eventBus.emit('state:local-brand-loaded', msg.config);
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
          // Clear progress indicator
          this.hideProgressIndicator();
          break;
        case 'OP_PROGRESS':
          this.updateProgressIndicator(msg);
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
      const isTemplate = sel.type === 'FRAME' && sel.name.startsWith('[Template]');
      const cleanName = isTemplate ? sel.name.replace('[Template]', '').trim() : sel.name;
      const templateBadge = isTemplate ? `<span class="sel-template-badge" title="Template reconhecido pelo plugin">TEMPLATE</span>` : '';
      
      const icon = this.getNodeTypeIcon(sel.type);
      const thumb = state.selectionThumb;
      const thumbHtml = thumb
        ? `<img class="sel-thumb" src="${thumb}" alt="">`
        : `<div class="sel-icon">${icon}</div>`;

      this.selectionIndicator.innerHTML = `
        ${thumbHtml}
        <div class="sel-info">
          <div class="sel-name" title="${this.escapeHtml(sel.name)}">
            ${this.escapeHtml(cleanName)}${templateBadge}
          </div>
          <div class="sel-type">${this.getNodeTypeLabel(sel.type)}</div>
        </div>
      `;
    } else {
      const templatesCount = selection.filter(s => s.type === 'FRAME' && s.name.startsWith('[Template]')).length;
      const templateText = templatesCount > 0 ? ` <span class="sel-template-badge" style="margin-left:2px; font-size:7px; padding:0 3px;">${templatesCount} TEMPLATE${templatesCount > 1 ? 'S' : ''}</span>` : '';
      
      const names = selection.map((s) => s.name).join(', ');
      this.selectionIndicator.innerHTML = `
        <div class="sel-icon">${selection.length}</div>
        <div class="sel-info">
          <div class="sel-multi">${selection.length} camadas selecionadas${templateText}</div>
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
   * Update progress indicator for operations
   */
  updateProgressIndicator(msg) {
    let indicator = document.getElementById('opProgressIndicator');

    if (!indicator) {
      // Create progress indicator in chat area
      indicator = document.createElement('div');
      indicator.id = 'opProgressIndicator';
      indicator.className = 'op-progress-indicator';
      const chatContainer = document.getElementById('chatContainer');
      if (chatContainer) {
        chatContainer.appendChild(indicator);
      }
    }

    const statusIcon = msg.status === 'done' ? '✅' : msg.status === 'error' ? '⚠️' : '⏳';
    const progressPercent = Math.round((msg.current / msg.total) * 100);

    indicator.innerHTML = `
      <div class="op-progress-bar">
        <div class="op-progress-fill" style="width: ${progressPercent}%"></div>
      </div>
      <div class="op-progress-text">
        ${statusIcon} ${msg.current}/${msg.total} — ${msg.opType} <span class="op-name">"${this.escapeHtml(msg.opName)}"</span>
      </div>
    `;
    indicator.classList.remove('hidden');

    // Auto-scroll to show progress
    indicator.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  /**
   * Hide progress indicator
   */
  hideProgressIndicator() {
    const indicator = document.getElementById('opProgressIndicator');
    if (indicator) {
      // Keep visible briefly to show completion
      setTimeout(() => {
        indicator.classList.add('hidden');
      }, 1000);
    }
  }

  /**
   * Escape HTML for safe rendering
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
