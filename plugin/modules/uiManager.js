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
    this._toastTimer = null;

    this.setupEventListeners();
    this.setupStateListeners();
    this.setupSandboxListeners();
    this.setupGlobalClickHandlers();

    // Initial fetch for session and state
    this.init();

    // Start real-time bridge via WebSocket
    this.initWebSocket();
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

  /**
   * Validate and normalize a potentially user-controlled avatar URL.
   * Only allow http/https URLs; return null for anything invalid or unsafe.
   */
  _getSafeAvatarUrl(urlString) {
    if (typeof urlString !== 'string' || !urlString.trim()) {
      return null;
    }
    try {
      const parsed = new URL(urlString, window.location.origin);
      const protocol = parsed.protocol.toLowerCase();
      if (protocol === 'https:' || protocol === 'http:') {
        return parsed.toString();
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  renderUserAvatar(user) {
    const avatarEl = document.getElementById('userAvatar');
    if (!avatarEl) return;

    // Clear existing content safely
    avatarEl.textContent = '';

    const safePhotoUrl = user ? this._getSafeAvatarUrl(user.photoUrl) : null;

    if (user && safePhotoUrl) {
      const img = document.createElement('img');
      img.src = safePhotoUrl;
      img.alt = user.name || '';
      avatarEl.appendChild(img);
      avatarEl.classList.add('has-photo');
    } else {
      // Initials fallback
      const initials = (user?.name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      avatarEl.textContent = initials;
      avatarEl.classList.remove('has-photo');
    }

    avatarEl.title = `Conectado como ${user?.name || ''}`;
  }

  /**
   * Show a unified toast notification
   * @param {string} message 
   * @param {'success'|'error'|'warning'|'info'} type 
   * @param {number} duration 
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Figma-style icons
    let icon = '';
    if (type === 'success') {
      icon = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else if (type === 'error') {
      icon = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    } else if (type === 'warning') {
      icon = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1.5v5M6 9h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    } else {
      icon = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2"/><path d="M6 4v2.5M6 8h.01" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
    }

    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);

    // Auto-remove with animation
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, duration);
  }

  setupGlobalClickHandlers() {
    // Close overflow menu when clicking outside
    // Close overflow menus when clicking outside
    document.addEventListener('click', (e) => {
      document.querySelectorAll('.overflow-menu').forEach(menu => {
        const triggerId = menu.id.replace('OverflowMenu', 'MoreBtn') || menu.id.replace('Menu', 'Btn');
        const trigger = document.getElementById(triggerId);
        
        if (trigger && !trigger.contains(e.target) && !menu.contains(e.target)) {
          menu.classList.add('hidden');
        }
      });
    });

    // Handle generic collapsible headers (with animation support)
    document.addEventListener('click', (e) => {
      const header = e.target.closest('.collapsible-header');
      if (header) {
        const targetId = header.dataset.target;
        const target = document.getElementById(targetId);
        if (target) {
          const isHidden = target.classList.contains('hidden');
          target.classList.toggle('hidden');
          header.setAttribute('data-collapsed', !isHidden);
        }
      }
    });
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

    // API Section toggles are now handled by generic setupCollapsibles logic in brand.js
    // if we added .collapsible-header class to them. 
    // However, uiManager.js has its own setup. Let's keep it but fix for new structure.
    document.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.collapsible');
        if (section && section.closest('#tab-config')) {
          section.classList.toggle('collapsed');
          const content = section.querySelector('.collapsible-content');
          content?.classList.toggle('hidden');
        }
      });
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

    // Option Tab Action Buttons
    document.getElementById('openProfileBtn')?.addEventListener('click', () => {
      window.open('https://www.visantlabs.com/perfil', '_blank');
    });
    document.getElementById('buyCreditsBtn')?.addEventListener('click', () => {
      window.open('https://www.visantlabs.com/pricing', '_blank');
    });
    document.getElementById('helpCenterBtn')?.addEventListener('click', () => {
      window.open('https://www.visantlabs.com/support', '_blank');
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

    // --- JSON Runner Logic (Settings Tab) ---
    const runJsonBtn = document.getElementById('runJsonBtn');
    if (runJsonBtn) {
      runJsonBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openDevSettings();
      });
    }

    const runBrandGridBtn = document.getElementById('jsonRunnerBrandGridBtn');
    if (runBrandGridBtn) {
      runBrandGridBtn.addEventListener('click', () => {
        this.generateBrandGridFromSelection();
      });
    }

    const runSocialBtn = document.getElementById('jsonRunnerSocialFramesBtn');
    if (runSocialBtn) {
      runSocialBtn.addEventListener('click', () => {
        this.generateSocialBrandFrames();
      });
    }

    const jsonExecuteBtn = document.getElementById('jsonRunnerExecuteBtn');
    if (jsonExecuteBtn) {
      jsonExecuteBtn.addEventListener('click', () => {
        const input = document.getElementById('jsonRunnerInput')?.value.trim();
        if (!input) {
          this.showToast('Cole o JSON primeiro', 'info');
          return;
        }
        try {
          const ops = JSON.parse(input);
          parent.postMessage({ pluginMessage: { type: 'APPLY_OPERATIONS', payload: ops } }, '*');
          this.showToast('Executando operações...', 'info');
        } catch (e) {
          this.showToast('JSON inválido: ' + e.message, 'error');
        }
      });
    }

    const jsonFormatBtn = document.getElementById('jsonRunnerFormatBtn');
    if (jsonFormatBtn) {
      jsonFormatBtn.addEventListener('click', () => {
        const textarea = document.getElementById('jsonRunnerInput');
        if (!textarea || !textarea.value.trim()) return;
        try {
          const json = JSON.parse(textarea.value);
          textarea.value = JSON.stringify(json, null, 2);
          this.showToast('JSON formatado', 'success');
        } catch (e) {
          this.showToast('JSON inválido para formatação', 'error');
        }
      });
    }

    const jsonClearBtn = document.getElementById('jsonRunnerClearBtn');
    if (jsonClearBtn) {
      jsonClearBtn.addEventListener('click', () => {
        const textarea = document.getElementById('jsonRunnerInput');
        if (textarea) textarea.value = '';
      });
    }

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
            status.innerHTML = `<span style="color: var(--figma-color-text-danger);">❌ ${this.escapeHtml(result.error)}</span>`;
          }
        } else {
          if (status) status.textContent = '';
        }
      } catch (err) {
        if (status) {
          status.innerHTML = `<span style="color: var(--figma-color-text-danger);">❌ ${this.escapeHtml(err.message)}</span>`;
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
          chatModule.addAssistantMessage(msg.message || '💎 Imagem colada no canvas!');
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
   * Update selection indicator in UI
   */
  updateSelectionIndicator(selection) {
    const chip = document.getElementById('selectionChip');
    const nameLabel = document.getElementById('selectionName');
    if (!chip || !nameLabel) return;
    
    if (selection && selection.length > 0) {
      const count = selection.length;
      const first = selection[0];
      const label = count > 1 ? `${first.name} +${count - 1}` : first.name;
      
      nameLabel.textContent = label;
      chip.classList.remove('hidden');
    } else {
      chip.classList.add('hidden');
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
   * Switch to a specific tab in settings
   * @param {string} tabId 
   */
  openTab(tabId) {
    // Update visibility of contents
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    const targetContent = document.getElementById(tabId);
    if (targetContent) targetContent.classList.remove('hidden');

    // Update active class on buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', isTarget);
    });
  }

  /**
   * Open settings view specifically on the Brand tab
   */
  openBrandSettings() {
    this.openSettings();
    this.openTab('tab-brand');
  }

  /**
   * Open settings view specifically on the Config tab
   */
  openConfigSettings() {
    this.openSettings();
    this.openTab('tab-config');
  }

  /**
   * Open settings view specifically on the Dev tab
   */
  openDevSettings() {
    this.openSettings();
    this.openTab('tab-dev');
  }

  /**
   * Expand a collapsible section
   * @param {string} targetId 
   */
  expandCollapsible(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    
    const header = document.querySelector(`.collapsible-header[data-target="${targetId}"]`);
    target.classList.remove('hidden');
    if (header) header.setAttribute('data-collapsed', 'false');
    
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
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
    const safeCurrent = Number(msg.current) || 0;
    const safeTotal = Number(msg.total) || 0;
    const progressPercent = safeTotal > 0 ? Math.round((safeCurrent / safeTotal) * 100) : 0;
    const safeOpType = this.escapeHtml(String(msg.opType ?? ''));
    const safeOpName = this.escapeHtml(String(msg.opName ?? ''));

    indicator.innerHTML = `
      <div class="op-progress-bar">
        <div class="op-progress-fill" style="width: ${progressPercent}%"></div>
      </div>
      <div class="op-progress-text">
        ${statusIcon} ${safeCurrent}/${safeTotal} — ${safeOpType} <span class="op-name">"${safeOpName}"</span>
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
    const initialsEl = document.getElementById('authUserInitials');
    const creditsEl = document.getElementById('authCreditsInfo');
    const creditsBar = document.getElementById('authCreditsBar');
    const statusEl = document.getElementById('authLoginStatus');

    if (authenticated && state.authEmail) {
      if (loggedOut) loggedOut.classList.add('hidden');
      if (loggedIn) loggedIn.classList.remove('hidden');
      if (emailEl) emailEl.textContent = state.authEmail;

      // Initials
      if (initialsEl) {
        const initials = state.authEmail.split('@')[0].substring(0, 1).toUpperCase();
        initialsEl.textContent = initials;
      }

      if (tierEl) {
        const tier = state.credits.tier || 'free';
        const tierLabels = { free: 'Free', premium: 'Premium', pro: 'Pro' };
        tierEl.textContent = tierLabels[tier] || tier;
        tierEl.className = `tier-badge ${tier}`;
      }

      if (creditsEl) {
        const c = state.credits;
        if (c.hasSubscription) {
          creditsEl.textContent = `${c.remaining} / ${c.total}`;
          if (creditsBar) {
            const pct = Math.max(0, Math.min(100, (c.remaining / c.total) * 100));
            creditsBar.style.width = `${pct}%`;
          }
        } else {
          creditsEl.textContent = `${c.freeRemaining} gerações grátis`;
          if (creditsBar) {
            const pct = Math.max(0, Math.min(100, (c.freeRemaining / 10) * 100)); // Default free 10
            creditsBar.style.width = `${pct}%`;
          }
        }
      }
      if (statusEl) statusEl.textContent = '';
    } else {
      if (loggedOut) loggedOut.classList.remove('hidden');
      if (loggedIn) loggedIn.classList.add('hidden');
    }
    this.renderCredits();
  }

  /**
   * Update credit pill in chat footer
   */
  /**
   * Render credit balance in header
   */
  renderCredits() {
    const pill = document.getElementById('creditBadge');
    if (!pill) return;

    if (!state.authToken || !state.credits) {
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
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Generates a professional Brand Grid from current selection
   * Based on the user's reference image
   */
  async generateBrandGridFromSelection() {
    const selection = getState('selectionDetails');
    if (!selection || selection.length === 0) {
      this.showToast('Selecione primeiro um componente ou logo no canvas', 'warning');
      return;
    }

    const sourceNode = selection[0];
    const ops = [];

    // 1. Root Board Frame
    ops.push({
      type: 'CREATE_FRAME',
      ref: 'brand_board',
      props: {
        name: `Brand Showcase: ${sourceNode.name}`,
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'FIXED', 
        width: 1400,
        itemSpacing: 64,
        paddingTop: 80, paddingRight: 80, paddingBottom: 80, paddingLeft: 80,
        fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }]
      }
    });

    // --- SECTIONS CONFIG ---
    const sections = [
      {
        id: 'fundo',
        title: 'Com Fundo',
        variations: [
          { name: 'Orange BG', bg: '#FF6000', logo: 'white' },
          { name: 'White BG', bg: '#FFFFFF', logo: 'black' },
          { name: 'Dark BG', bg: '#1A1A1A', logo: 'orange' },
          { name: 'Contrast BG', bg: '#000000', logo: 'white' }
        ]
      },
      {
        id: 'isolado',
        title: 'Isolado',
        variations: [
          { name: 'Black Logo', bg: null, logo: '#000000' },
          { name: 'Orange Logo', bg: null, logo: '#FF6000' },
          { name: 'White Logo', bg: null, logo: '#FFFFFF' }
        ]
      }
    ];

    for (const section of sections) {
      const sectionRef = `section_${section.id}`;
      
      // Section Container
      ops.push({
        type: 'CREATE_FRAME',
        ref: sectionRef,
        parentRef: 'brand_board',
        props: {
          name: section.title,
          layoutMode: 'VERTICAL',
          itemSpacing: 24,
          fills: []
        }
      });

      // Section Title
      ops.push({
        type: 'CREATE_TEXT',
        parentRef: sectionRef,
        props: {
          content: section.title,
          fontSize: 18,
          fontStyle: 'Bold',
          fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }]
        }
      });

      // Grid Container
      const gridRef = `grid_${section.id}`;
      ops.push({
        type: 'CREATE_FRAME',
        ref: gridRef,
        parentRef: sectionRef,
        props: {
          name: 'Variants Grid',
          layoutMode: 'HORIZONTAL',
          layoutWrap: 'WRAP',
          itemSpacing: 24,
          fills: []
        }
      });

      // Variations
      for (let i = 0; i < section.variations.length; i++) {
        const v = section.variations[i];
        const vRef = `v_${section.id}_${i}`;
        const cardW = 280;
        const cardH = 160;
        const padding = 40;
        const maxW = cardW - (padding * 2);
        const maxH = cardH - (padding * 2);

        // Calculate scale to fit
        let scale = 1;
        if (sourceNode.width > 0 && sourceNode.height > 0) {
          scale = Math.min(maxW / sourceNode.width, maxH / sourceNode.height);
          if (scale > 1) scale = 1; // Don't upscale logos
        }

        const newW = sourceNode.width * scale;
        const newH = sourceNode.height * scale;

        // Asset Card
        ops.push({
          type: 'CREATE_FRAME',
          ref: vRef,
          parentRef: gridRef,
          props: {
            name: v.name,
            width: cardW, height: cardH,
            fills: v.bg ? [{ type: 'SOLID', color: v.bg }] : [],
            cornerRadius: 4,
            clipsContent: true,
            // Center the logo using Auto Layout
            layoutMode: 'HORIZONTAL',
            primaryAxisAlignItems: 'CENTER',
            counterAxisAlignItems: 'CENTER'
          }
        });

        // Clone logo into card
        ops.push({
          type: 'CLONE_NODE',
          sourceNodeId: sourceNode.id,
          parentRef: vRef,
          overrides: {
            name: 'Logo Instance',
            width: newW,
            height: newH
          }
        });

        // Sub-label for variant
        if (!v.bg) {
          ops.push({
            type: 'CREATE_TEXT',
            parentRef: vRef,
            props: {
              content: 'Isolado',
              fontSize: 10,
              y: 140, x: 10,
              fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }]
            }
          });
        }
      }
    }

    // Send to sandbox
    parent.postMessage({ pluginMessage: { type: 'APPLY_OPERATIONS', payload: ops } }, '*');
    this.showToast('Gerando Brand Showcase no Canvas...', 'success');
  }

  /**
   * Generates frames in 16:9 and 1:1 using all colors from the brand guideline
   * Directly on the canvas, without nested helper frames
   */
  async generateSocialBrandFrames() {
    const brandColors = getState('selectedColors');
    const brandGuideline = getState('linkedGuideline');
    const selection = getState('selectionDetails') || [];

    if (!brandColors || (brandColors instanceof Map ? brandColors.size === 0 : Object.keys(brandColors).length === 0)) {
      this.showToast('Nenhuma cor de brand configurada no Brand Hub.', 'warning');
      return;
    }

    if (selection.length === 0) {
      this.showToast('Selecione primeiro um ou mais logos no Figma.', 'warning');
      return;
    }

    const ops = [];
    const colors = brandColors instanceof Map 
      ? Array.from(brandColors.values()) 
      : Object.values(brandColors);

    const sizes = [
      { name: '16:9', w: 1280, h: 720, id: 'wide' },
      { name: '1:1', w: 1080, h: 1080, id: 'post' }
    ];

    // Manual positioning to ensure 100% accuracy regardless of siblings
    const pivot = selection[0] || { x: 0, y: 0, height: 0 };
    const startX = pivot.x ?? 0;
    const startY = (pivot.y ?? 0) + (pivot.height ?? 0) + 500;
    const horizontalGap = 100;
    const verticalGap = 150;
    
    let currentRow = 0;

    // For each selected component (logo)
    selection.forEach((sourceNode, selIdx) => {
      // For each size format (Wide/Post)
      sizes.forEach((size, sizeIdx) => {
        // For each brand color
        colors.forEach((color, colorIdx) => {
          const hex = color.value || color.hex || '#FFFFFF';
          const variableId = color.variableId; // Use variable ID if synced
          const frameRef = `frame_s_${selIdx}_${size.id}_${colorIdx}`;
          
          // Calculate grid position manually
          const x = startX + colorIdx * (size.w + horizontalGap);
          const y = startY + currentRow * (1080 + verticalGap);
          
          ops.push({
            type: 'CREATE_FRAME',
            ref: frameRef,
            props: {
              name: `${sourceNode.name} | ${color.name || 'Brand'} - ${size.name}`,
              width: size.w, height: size.h,
              x: x,
              y: y,
              fills: [{ type: 'SOLID', color: hex, variableId }], // Variable binding if available
              cornerRadius: 12,
              clipsContent: true,
              layoutMode: 'HORIZONTAL',
              primaryAxisSizingMode: 'FIXED', 
              counterAxisSizingMode: 'FIXED', 
              primaryAxisAlignItems: 'CENTER',
              counterAxisAlignItems: 'CENTER'
            }
          });

          // Create official Component Instance if possible, otherwise clone
          const maxWidth = size.w * 0.5;
          const maxHeight = size.h * 0.5;
          let scale = 1;
          if (sourceNode.width > 0 && sourceNode.height > 0) {
            scale = Math.min(maxWidth / sourceNode.width, maxHeight / sourceNode.height);
            if (scale > 1) scale = 1;
          }

          const logoWidth = sourceNode.width * scale;
          const logoHeight = sourceNode.height * scale;
          const logoRef = `logo_s_${selIdx}_${size.id}_${colorIdx}`;

          if (sourceNode.componentKey) {
            ops.push({
              type: 'CREATE_COMPONENT_INSTANCE',
              ref: logoRef,
              parentRef: frameRef,
              componentKey: sourceNode.componentKey,
              name: 'Logo Instance',
              width: logoWidth,
              height: logoHeight
            });
          } else {
            ops.push({
              type: 'CLONE_NODE',
              ref: logoRef,
              sourceNodeId: sourceNode.id,
              parentRef: frameRef,
              overrides: {
                name: 'Logo Clone',
                width: logoWidth,
                height: logoHeight
              }
            });
          }

          // Contrast coloring
          ops.push({
            type: 'RECOLOR_NODE',
            ref: logoRef,
            props: {
              fills: [{ type: 'SOLID', color: this.getContrastColor(hex) }]
            }
          });
        });

        // --- NEW: Transparent variations after the colored ones ---
        const transparentVariants = [
          ...colors.map(c => ({ name: `${c.name || 'Brand'} Color`, color: c.value || c.hex || '#FFFFFF', variableId: c.variableId })),
          { name: 'Black Logo', color: '#000000' },
          { name: 'White Logo', color: '#FFFFFF' }
        ];

        transparentVariants.forEach((variant, vIdx) => {
          const frameRef = `frame_s_${selIdx}_${size.id}_trans_${vIdx}`;
          const x = startX + (colors.length + vIdx) * (size.w + horizontalGap);
          const y = startY + currentRow * (1080 + verticalGap);

          ops.push({
            type: 'CREATE_FRAME',
            ref: frameRef,
            props: {
              name: `${sourceNode.name} | Transparent - ${variant.name} - ${size.name}`,
              width: size.w, height: size.h,
              x: x,
              y: y,
              fills: [], // Transparent
              cornerRadius: 12,
              clipsContent: true,
              layoutMode: 'HORIZONTAL',
              primaryAxisSizingMode: 'FIXED', 
              counterAxisSizingMode: 'FIXED', 
              primaryAxisAlignItems: 'CENTER',
              counterAxisAlignItems: 'CENTER'
            }
          });

          const logoRef = `logo_s_${selIdx}_${size.id}_trans_${vIdx}`;
          const maxWidth = size.w * 0.5;
          const maxHeight = size.h * 0.5;
          let scale = 1;
          if (sourceNode.width > 0 && sourceNode.height > 0) {
            scale = Math.min(maxWidth / sourceNode.width, maxHeight / sourceNode.height);
            if (scale > 1) scale = 1;
          }

          const logoWidth = sourceNode.width * scale;
          const logoHeight = sourceNode.height * scale;

          if (sourceNode.componentKey) {
            ops.push({
              type: 'CREATE_COMPONENT_INSTANCE',
              ref: logoRef,
              parentRef: frameRef,
              componentKey: sourceNode.componentKey,
              name: 'Logo Instance',
              width: logoWidth,
              height: logoHeight
            });
          } else {
            ops.push({
              type: 'CLONE_NODE',
              ref: logoRef,
              sourceNodeId: sourceNode.id,
              parentRef: frameRef,
              overrides: {
                name: 'Logo Clone',
                width: logoWidth,
                height: logoHeight
              }
            });
          }

          ops.push({
            type: 'RECOLOR_NODE',
            ref: logoRef,
            props: {
              fills: [{ type: 'SOLID', color: variant.color, variableId: variant.variableId }]
            }
          });
        });

        currentRow++;
      });
      currentRow++;
    });

    parent.postMessage({ pluginMessage: { type: 'APPLY_OPERATIONS', payload: ops } }, '*');
    this.showToast(`Gerando ${ops.filter(o => o.type === 'CREATE_FRAME').length} frames independentes...`, 'success');
  }

  /**
   * Determine contrast color (black/white) based on background hex
   */
  getContrastColor(hex) {
    try {
      if (!hex) return '#000000';
      const clean = String(hex).replace('#', '');
      if (clean.length < 6) return '#000000';
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 128) ? '#000000' : '#FFFFFF';
    } catch (e) {
      return '#000000';
    }
  }
}

// Global accessor
window.showToast = (msg, type, duration) => {
  if (window.uiManager) window.uiManager.showToast(msg, type, duration);
};

const uiManager = new UIManager();
window.uiManager = uiManager;
