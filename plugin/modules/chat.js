/**
 * Chat module - Handle chat UI and messaging
 * Uses native Figma plugin CSS variables and chat-msg classes from ui.css
 */

class ChatModule {
  constructor() {
    this.chatMessages = document.getElementById('chatMessages');
    this.chatInput = document.getElementById('chatInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.statusEl = document.getElementById('status');
    this.isLoading = false;
    this._typingBubble = null;
    this._typingTimer = null;
    this._glitchTimer = null;
    this._dotsTimer = null;
    this._requestStartTime = null;
    this.operationsMap = {};

    this.setupEventListeners();
    this.setupStateListeners();

    // Delegated click handler for node chips in chat messages
    this.chatMessages.addEventListener('click', (e) => {
      const chip = e.target.closest('.node-chip');
      if (chip && chip.dataset.nodeId) {
        parent.postMessage(
          { pluginMessage: { type: 'SELECT_AND_ZOOM', nodeId: chip.dataset.nodeId } },
          '*'
        );
      }

      // Handler for view operations data button
      const viewDataBtn = e.target.closest('.msg-view-data-btn');
      if (viewDataBtn) {
        const msgIndex = viewDataBtn.dataset.msgIndex;
        this.showOperationsModal(msgIndex);
      }
    });
  }

  setupEventListeners() {
    this.sendBtn.addEventListener('click', () => this.sendMessage());

    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.chatInput.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
      this.updateImageGenerationButton();
    });

    // Scan Page toggle pill
    const scanPill = document.getElementById('scanPagePill');
    if (scanPill) {
      scanPill.addEventListener('click', () => {
        const next = !state.scanPage;
        setState('scanPage', next);
        scanPill.classList.toggle('active', next);
      });
    }

    // Think mode toggle pill
    const thinkPill = document.getElementById('thinkPill');
    if (thinkPill) {
      thinkPill.addEventListener('click', () => {
        const next = !state.thinkMode;
        setState('thinkMode', next);
        thinkPill.classList.toggle('active', next);
      });
    }

    // Stop generation button
    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        cancelCurrentRequest();
        this.removeTypingBubble();
        this.setLoading(false);
      });
    }

    // Attach button → open file picker
    const attachBtn = document.getElementById('attachBtn');
    const attachInput = document.getElementById('attachInput');
    if (attachBtn && attachInput) {
      attachBtn.addEventListener('click', () => attachInput.click());
      attachInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    // Generate Image button
    const genImageBtn = document.getElementById('genImageBtn');
    if (genImageBtn) {
      genImageBtn.addEventListener('click', () => this.handleGenerateImageClick());
    }

    // Toolbar More/Overflow menu
    const moreBtn = document.getElementById('toolbarMoreBtn');
    const overflowMenu = document.getElementById('toolbarOverflowMenu');
    if (moreBtn && overflowMenu) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        overflowMenu.classList.toggle('hidden');
      });
    }

    // Input Validation (Real-time)
    const cw = document.getElementById('customWidth');
    const ch = document.getElementById('customHeight');
    if (cw) {
      cw.addEventListener('input', () => {
        const val = parseInt(cw.value);
        if (val > 4000) cw.style.boxShadow = 'inset 0 0 0 1px var(--figma-color-bg-danger)';
        else cw.style.boxShadow = '';
      });
    }
    if (ch) {
      ch.addEventListener('input', () => {
        const val = parseInt(ch.value);
        if (val > 4000) ch.style.boxShadow = 'inset 0 0 0 1px var(--figma-color-bg-danger)';
        else ch.style.boxShadow = '';
      });
    }

    // Code button
    const codeBtn = document.getElementById('codeBtn');
    if (codeBtn) {
      codeBtn.addEventListener('click', () => {
        this.showLatestOperationsData();
      });
    }

    // Image Generation Settings Panel
    const genImageSettingsBtn = document.getElementById('genImageSettingsBtn');

    if (genImageSettingsBtn) {
      genImageSettingsBtn.addEventListener('click', () => {
        if (window.uiManager) {
          window.uiManager.openConfigSettings();
          window.uiManager.expandCollapsible('imageGenContent');
        }
        if (overflowMenu) overflowMenu.classList.add('hidden');
      });
    }

    // Modal close handlers (using class name convention from uiManager)
    const closeOpsModal = document.getElementById('closeOperationsModal');
    if (closeOpsModal) {
      closeOpsModal.addEventListener('click', () => {
        document.getElementById('operationsModal').classList.add('hidden');
      });
    }


    // Frame size selection
    const frameSizeButtons = document.querySelectorAll('.settings-option[data-size]');
    frameSizeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.size;
        setState('selectedFrameSize', size);

        // Show/hide custom size input
        const customSizeGroup = document.getElementById('customSizeGroup');
        if (size === 'custom') {
          customSizeGroup?.classList.remove('hidden');
        } else {
          customSizeGroup?.classList.add('hidden');
        }

        // Update active button state
        frameSizeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Set initial active button
    const initialSize = state.selectedFrameSize;
    frameSizeButtons.forEach(btn => {
      if (btn.dataset.size === initialSize) {
        btn.classList.add('active');
      }
    });

    // Custom size inputs (Real-time validation)
    const customWidth = document.getElementById('customWidth');
    const customHeight = document.getElementById('customHeight');
    if (customWidth) {
      customWidth.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 0;
        if (val > 4000) {
          e.target.style.borderColor = 'var(--figma-color-text-danger)';
        } else {
          e.target.style.borderColor = '';
        }
        updateAspectRatio();
      });
      customWidth.addEventListener('change', (e) => {
        const val = Math.max(100, Math.min(4000, parseInt(e.target.value) || 800));
        setState('customWidth', val);
        e.target.value = val;
        e.target.style.borderColor = '';
      });
    }
    if (customHeight) {
      customHeight.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 0;
        if (val > 4000) {
          e.target.style.borderColor = 'var(--figma-color-text-danger)';
        } else {
          e.target.style.borderColor = '';
        }
        updateAspectRatio();
      });
      customHeight.addEventListener('change', (e) => {
        const val = Math.max(100, Math.min(4000, parseInt(e.target.value) || 450));
        setState('customHeight', val);
        e.target.value = val;
        e.target.style.borderColor = '';
      });
    }

    // Model selector buttons
    const modelBtns = document.querySelectorAll('.model-btn');
    modelBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const model = btn.dataset.model;
        setState('selectedModel', model);

        // Update active button
        modelBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update resolution options (they change based on model)
        this.updateResolutionOptions();
      });
    });

    // Populate resolution options based on model
    this.updateResolutionOptions();

    // Watch for model changes to update resolution options
    watchState('selectedModel', () => {
      this.updateResolutionOptions();
    });

    // Custom size input handlers for aspect ratio display

    const updateAspectRatio = () => {
      const width = parseInt(customWidth?.value || 800);
      const height = parseInt(customHeight?.value || 450);
      if (width > 0 && height > 0) {
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(width, height);
        const ratioW = width / divisor;
        const ratioH = height / divisor;
        const aspectDisplay = document.getElementById('aspectRatioDisplay');
        if (aspectDisplay) {
          aspectDisplay.textContent = `${Math.round(ratioW)}:${Math.round(ratioH)}`;
        }
      }
    };

    if (customWidth) customWidth.addEventListener('input', updateAspectRatio);
    if (customHeight) customHeight.addEventListener('input', updateAspectRatio);

    // Resolution selection
    this.setupResolutionHandlers();
  }

  /**
   * Update resolution options based on selected model
   */
  updateResolutionOptions() {
    const resolutionDiv = document.getElementById('resolutionOptions');
    if (!resolutionDiv) return;

    const isProModel = state.selectedModel === 'gemini-3-pro-image-preview';
    const options = isProModel
      ? ['1K', '2K', '4K']
      : ['HD'];

    resolutionDiv.innerHTML = options.map(opt => `
      <button class="settings-option" data-resolution="${opt}" data-selected="no">
        <span class="option-label">${opt}</span>
        <span class="option-desc">${opt === 'HD' ? '1280×720' : opt === '1K' ? '1024×1024' : opt === '2K' ? '2048×2048' : '4096×4096'}</span>
      </button>
    `).join('');

    // Set initial selection
    const currentResolution = state.selectedResolution;
    const buttons = resolutionDiv.querySelectorAll('.settings-option[data-resolution]');
    buttons.forEach(btn => {
      if (btn.dataset.resolution === currentResolution) {
        btn.classList.add('active');
      }
    });

    // Re-attach handlers
    this.setupResolutionHandlers();
  }

  /**
   * Setup resolution selection handlers
   */
  setupResolutionHandlers() {
    const resolutionDiv = document.getElementById('resolutionOptions');
    if (!resolutionDiv) return;

    const buttons = resolutionDiv.querySelectorAll('.settings-option[data-resolution]');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const resolution = btn.dataset.resolution;
        setState('selectedResolution', resolution);

        // Update active button
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  setupStateListeners() {
    watchState('chatHistory', () => {
      this.renderMessages();
    });

    watchState('pendingAttachments', () => {
      this.renderAttachmentPreview();
    });

    eventBus.on('chat:loading', (isLoading) => {
      this.setLoading(isLoading);
    });

    eventBus.on('api:error', (error) => {
      this.removeTypingBubble();
      this.addErrorMessage(`Erro: ${error.error}`);
      window.showToast(error.error, 'error');
      this.setLoading(false);
    });

    // Design system module events → chat bubbles
    eventBus.on('chat:error-message', (msg) => {
      this.addErrorMessage(msg);
    });

    eventBus.on('chat:assistant-message', (msg) => {
      this.addAssistantMessage(msg);
    });

    // Main response handler — reads MESSAGE ops as text, rest as design ops
    eventBus.on('api:design-generated', (result) => {
      this.removeTypingBubble();

      const ops = result.operations || [];
      const messageOps = ops.filter(op => op.type === 'MESSAGE');
      const designOps = ops.filter(op => op.type !== 'MESSAGE');

      if (messageOps.length > 0) {
        // Show each MESSAGE op content as a chat bubble
        messageOps.forEach(op => {
          if (op.content) this.addAssistantMessage(op.content, null, designOps);
        });
      }

      if (designOps.length > 0) {
        // Build rich status line with time + tokens
        const n = designOps.length;
        const parts = [`✦ ${n} operação${n > 1 ? 'ões' : ''}`];
        if (result.provider) parts.push(result.provider);

        // Elapsed time
        const elapsed = this._requestStartTime ? ((Date.now() - this._requestStartTime) / 1000) : null;
        if (elapsed) parts.push(`${elapsed.toFixed(1)}s`);

        // Token usage from server
        if (result.usage && result.usage.totalTokens) {
          const t = result.usage.totalTokens;
          const label = t >= 1000 ? `${(t / 1000).toFixed(1)}k` : `${t}`;
          parts.push(`${label} tokens`);
        }

        // If no MESSAGE ops, still save operations to history with status text
        if (messageOps.length === 0) {
          this.addAssistantMessage(parts.join(' · '), result.summaryItems || null, designOps);
        } else {
          this.addStatusMessage(parts.join(' · '));
        }
        eventBus.emit('chat:operations-ready', designOps);
      }

      // If nothing useful came back at all
      if (ops.length === 0) {
        this.addErrorMessage('❌ Nenhuma resposta gerada. Tente ser mais específico.');
      }

      this.setLoading(false);
    });

  }

  /**
   * Send user message with optional attachments
   */
  async sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message || this.isLoading) return;

    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';

    // Extract mentions and clean text for display
    let mentions = [];
    let displayMessage = message;

    if (typeof MentionsModule !== 'undefined' && MentionsModule.extractMentions) {
      const result = MentionsModule.extractMentions(message);
      mentions = result.mentions || [];
      displayMessage = result.cleanText || message;
    }

    // Grab pending attachments
    const attachments = [...state.pendingAttachments];

    this.addUserMessage(displayMessage, mentions, attachments);
    this.setLoading(true);
    this._requestStartTime = Date.now();
    this.showTypingBubble();

    try {
      // Send original message with mentions and attachments to server
      generateWithContext(message, { fileId: state.sessionId, mentions, attachments });
      // Clear pending attachments after send
      setState('pendingAttachments', []);
      // Reset file input
      const attachInput = document.getElementById('attachInput');
      if (attachInput) attachInput.value = '';
    } catch (error) {
      this.removeTypingBubble();
      this.addErrorMessage(`Falha ao enviar: ${error.message}`);
      this.setLoading(false);
    }
  }

  addUserMessage(content, mentions = [], attachments = []) {
    // New array reference so setState's reference-equality check fires
    setState('chatHistory', [...state.chatHistory, { role: 'user', content, isError: false, mentions, attachments }]);
  }

  addAssistantMessage(content, summaryItems, operations) {
    const newHistory = [...state.chatHistory, {
      role: 'assistant',
      content,
      isError: false,
      summaryItems: summaryItems || null,
      operations: operations || null
    }];
    setState('chatHistory', newHistory);
  }

  addErrorMessage(content) {
    setState('chatHistory', [...state.chatHistory, { role: 'assistant', content, isError: true }]);
  }

  addStatusMessage(content) {
    setState('chatHistory', [...state.chatHistory, { role: 'status', content, isError: false }]);
  }

  /**
   * Show animated typing indicator while AI is processing.
   * GlitchLoader-style: random chars + glitch-reveal word transitions + animated dots + timer.
   */
  showTypingBubble(customWords = null) {
    this.removeTypingBubble();

    const defaultWords = [
      'Criando', 'Desenhando', 'Esculpindo', 'Burilando',
      'Arquitetando', 'Rabiscando', 'Refinando', 'Compondo',
      'Moldando', 'Traçando', 'Prototipando', 'Lapidando',
    ];
    const words = customWords || defaultWords;
    const glitchChars = '*•□/-®▸◆○~#%&';
    const revealChars = 'abcdefghijklmnopqrstuvwxyz*•-□';
    let wordIdx = Math.floor(Math.random() * words.length);

    const randChar = (pool) => pool[Math.floor(Math.random() * pool.length)];
    const randomGlitch = () =>
      Array.from({ length: 4 }, () => randChar(glitchChars)).join('');

    const el = document.createElement('div');
    el.className = 'chat-message assistant chat-typing';
    el.id = 'typingBubble';
    el.innerHTML = `
      <div class="message-avatar" style="background:transparent;border:none;font-size:16px;">💎</div>
      <div class="message-body" style="display: flex; align-items: center;">
        <span class="typing-glitch">${randomGlitch()}</span>
        <span class="typing-word">${words[wordIdx]}</span>
        <span class="typing-dots-anim">.</span>
        <span class="typing-timer" style="margin-left:auto;">0:00</span>
      </div>
    `;
    this.chatMessages.appendChild(el);
    this._typingBubble = el;

    const glitchEl = el.querySelector('.typing-glitch');
    const wordEl = el.querySelector('.typing-word');
    const dotsEl = el.querySelector('.typing-dots-anim');
    const timerEl = el.querySelector('.typing-timer');
    const start = Date.now();

    /**
     * Glitch-reveal a new word over ~350ms:
     * starts fully scrambled, progressively uncovers chars left-to-right.
     */
    const glitchReveal = (target) => {
      const len = target.length;
      const totalSteps = 7;
      let step = 0;
      const iv = setInterval(() => {
        step++;
        if (step >= totalSteps) {
          clearInterval(iv);
          if (wordEl) wordEl.textContent = target;
          return;
        }
        const revealed = Math.floor((step / totalSteps) * len);
        const result = Array.from({ length: len }, (_, i) =>
          i < revealed ? target[i] : randChar(revealChars)
        ).join('');
        if (wordEl) wordEl.textContent = result;
      }, 50); // 7 steps × 50ms = ~350ms
    };

    // Glitch chars — 150ms matches GlitchLoader
    this._glitchTimer = setInterval(() => {
      if (glitchEl) glitchEl.textContent = randomGlitch();
    }, 150);

    // Dots micro-animation: . → .. → ... → .
    let dotCount = 1;
    this._dotsTimer = setInterval(() => {
      dotCount = dotCount >= 3 ? 1 : dotCount + 1;
      if (dotsEl) dotsEl.textContent = '.'.repeat(dotCount);
    }, 380);

    // Timer + word rotation every 1s
    this._typingTimer = setInterval(() => {
      const sec = Math.floor((Date.now() - start) / 1000);
      const min = Math.floor(sec / 60);
      const s = sec % 60;
      if (timerEl) timerEl.textContent = `${min}:${String(s).padStart(2, '0')}`;
      // Glitch-reveal new word every 3s
      if (sec > 0 && sec % 3 === 0) {
        wordIdx = (wordIdx + 1) % words.length;
        glitchReveal(words[wordIdx]);
      }
    }, 1000);

    this._scrollToBottom();
  }

  removeTypingBubble() {
    if (this._dotsTimer) {
      clearInterval(this._dotsTimer);
      this._dotsTimer = null;
    }
    if (this._glitchTimer) {
      clearInterval(this._glitchTimer);
      this._glitchTimer = null;
    }
    if (this._typingTimer) {
      clearInterval(this._typingTimer);
      this._typingTimer = null;
    }
    if (this._typingBubble) {
      this._typingBubble.remove();
      this._typingBubble = null;
    }
    const existing = document.getElementById('typingBubble');
    if (existing) existing.remove();
  }

  /**
   * Render full message history
   */
  renderMessages() {
    this.chatMessages.innerHTML = '';
    this.operationsMap = {};

    state.chatHistory.forEach((msg, idx) => {
      const el = document.createElement('div');

      if (msg.role === 'status') {
        el.className = 'chat-status-line';
        el.textContent = msg.content;
      } else if (msg.role === 'user') {
        el.className = 'chat-message user';

        let attachHtml = '';
        if (msg.attachments && msg.attachments.length > 0) {
          attachHtml = '<div style="margin-top:6px;">' + (
            msg.attachments.map(att => att.type === 'image' ?
              `<img class="attachment-img" src="${att.dataUrl}" alt="${att.name}">` :
              `<span class="attachment-file-chip">📄 ${att.name}</span>`
            ).join('')
          ) + '</div>';
        }

        el.innerHTML = `
          <div class="message-avatar" style="background:transparent;border:none;font-size:14px;">👤</div>
          <div class="message-body">
            ${this.escapeHtml(msg.content)}
            ${attachHtml}
          </div>
        `;
      } else {
        // assistant
        el.className = `chat-message assistant${msg.isError ? ' error' : ''}`;
        let renderedHtml = this.renderMarkdown(msg.content, msg.summaryItems);

        // Collapse long summary lists (>5 lines) with "Mostrar mais" toggle
        if (msg.summaryItems && msg.summaryItems.length > 5) {
          const lines = renderedHtml.split('<br>');
          if (lines.length > 5) {
            const visible = lines.slice(0, 5).join('<br>');
            const hidden = lines.slice(5).join('<br>');
            const toggleId = `summary-toggle-${idx}`;
            renderedHtml = `${visible}<div id="${toggleId}-hidden" class="summary-collapsed" style="display:none">${hidden.startsWith('<br>') ? hidden : '<br>' + hidden}</div><button class="summary-toggle-btn" data-toggle-id="${toggleId}" onclick="(function(btn){var el=document.getElementById(btn.dataset.toggleId+'-hidden');if(el.style.display==='none'){el.style.display='block';btn.textContent='▲ Mostrar menos';}else{el.style.display='none';btn.textContent='▼ Mostrar mais ('+el.querySelectorAll('.node-chip,.node-chip-static').length+')';};})(this)">▼ Mostrar mais (${msg.summaryItems.length - 5})</button>`;
          }
        }

        let footerHtml = '';
        // Store operations data if present
        if (msg.operations && msg.operations.length > 0) {
          this.operationsMap[idx] = msg.operations;
          footerHtml = `
            <div class="msg-footer">
              <button class="msg-view-data-btn" data-msg-index="${idx}" title="Ver dados das operações">
                📋 Ver dados
              </button>
            </div>
          `;
        }

        el.innerHTML = `
          <div class="message-avatar" style="background:transparent;border:none;font-size:16px;">💎</div>
          <div class="message-body">
            ${renderedHtml}
            ${footerHtml}
          </div>
        `;
      }

      this.chatMessages.appendChild(el);
    });

    this._scrollToBottom();
  }

  /**
   * Very light markdown renderer (bold, newline, code) + clickable node chips
   */
  renderMarkdown(text, summaryItems) {
    if (!text) return '';
    const nodeMap = this._buildNodeMap(summaryItems);
    let html = this.escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\n/g, '<br>');

    // Replace @&quot;name&quot; patterns with clickable node chips
    // After escapeHtml, quotes become &quot;
    html = html.replace(/@&quot;([^&]+?)&quot;/g, (match, name) => {
      const nodeId = nodeMap[name];
      if (nodeId) {
        return `<span class="node-chip" data-node-id="${this.escapeHtml(nodeId)}" title="Clique para selecionar e ver no canvas">@${name}</span>`;
      }
      return `<span class="node-chip-static">@"${name}"</span>`;
    });

    return html;
  }

  /**
   * Build name→nodeId map from summaryItems
   */
  _buildNodeMap(summaryItems) {
    const map = {};
    if (!summaryItems || !Array.isArray(summaryItems)) return map;
    for (const item of summaryItems) {
      if (item.nodeName && item.nodeId) {
        map[item.nodeName] = item.nodeId;
      }
    }
    return map;
  }

  setLoading(isLoading) {
    this.isLoading = isLoading;
    this.sendBtn.disabled = isLoading;
    this.chatInput.disabled = isLoading;

    const stopBtn = document.getElementById('stopBtn');
    if (isLoading) {
      this.sendBtn.classList.add('hidden');
      if (stopBtn) stopBtn.classList.remove('hidden');
      // Toast instead of persistent status if it's transient, 
      // but here we keep the status line hidden and use typing bubble.
      this.statusEl.classList.add('hidden');
    } else {
      this.sendBtn.classList.remove('hidden');
      if (stopBtn) stopBtn.classList.add('hidden');
      this.statusEl.classList.add('hidden');
    }
  }

  clearHistory() {
    if (confirm('Limpar histórico de chat?')) {
      // Reset to a brand-new array reference
      setState('chatHistory', [
        { role: 'assistant', content: 'Olá! Descreva o que quer criar ou modificar. Configure as Brand Guidelines em ⚙ Configurações.', isError: false },
      ]);
      setState('sessionId',
        window.crypto && typeof window.crypto.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
      );
    }
  }

  _scrollToBottom() {
    requestAnimationFrame(() => {
      const wrap = this.chatMessages.closest('.chat-messages-wrap') || this.chatMessages;
      wrap.scrollTop = wrap.scrollHeight;
    });
  }

  /**
   * Helper to show data from latest assistant message
   */
  showLatestOperationsData() {
    // Find latest assistant message with operations
    for (let i = state.chatHistory.length - 1; i >= 0; i--) {
      const msg = state.chatHistory[i];
      if (msg.role === 'assistant' && msg.operations && msg.operations.length > 0) {
        this.showOperationsModal(i);
        return;
      }
    }
    window.showToast('Nenhum dado de operação disponível no momento.', 'info');
  }

  /**
   * Show operations modal with data
   */
  showOperationsModal(msgIndex) {
    const operations = this.operationsMap[msgIndex];
    if (!operations || operations.length === 0) return;

    const modal = document.getElementById('operationsModal');
    const content = document.getElementById('operationsModalContent');

    if (!modal || !content) return;

    // Render operations list + JSON
    let html = `
      <div class="operations-container">
        <div class="ops-section">
          <div class="ops-title">Operações (${operations.length})</div>
          <div class="ops-list">
    `;

    operations.forEach((op, i) => {
      const opName = op.props?.name ? ` — ${this.escapeHtml(op.props.name)}` : '';
      html += `<div class="op-item">
                <span class="op-num">${i + 1}.</span>
                <span class="op-type">${this.escapeHtml(op.type)}</span>
                <span class="op-name">${opName}</span>
              </div>`;
    });

    html += `
          </div>
        </div>
        <div class="ops-section">
          <div class="ops-title">JSON</div>
          <div class="ops-json-wrapper">
            <div class="ops-json-toolbar">
              <button class="ops-json-action-btn" id="opsJsonCopyBtn" title="Copiar JSON">📋 Copiar</button>
              <button class="ops-json-action-btn" id="opsJsonSaveBtn" title="Salvar JSON como arquivo">💾 Salvar</button>
            </div>
            <pre class="ops-json"><code>${this.escapeHtml(JSON.stringify(operations, null, 2))}</code></pre>
          </div>
        </div>
      </div>
    `;

    content.innerHTML = html;

    // Wire up copy button
    const copyBtn = content.querySelector('#opsJsonCopyBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const json = JSON.stringify(operations, null, 2);
        navigator.clipboard.writeText(json).then(() => {
          copyBtn.classList.add('copied');
          copyBtn.textContent = '✅ Copiado!';
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.textContent = '📋 Copiar';
          }, 1500);
        }).catch(() => {
          // Fallback for environments without clipboard API
          const ta = document.createElement('textarea');
          ta.value = json;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          copyBtn.classList.add('copied');
          copyBtn.textContent = '✅ Copiado!';
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.textContent = '📋 Copiar';
          }, 1500);
        });
      });
    }

    // Wire up save button
    const saveBtn = content.querySelector('#opsJsonSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const json = JSON.stringify(operations, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `operations-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        saveBtn.textContent = '✅ Salvo!';
        setTimeout(() => { saveBtn.textContent = '💾 Salvar'; }, 1500);
      });
    }

    modal.classList.remove('hidden');
  }

  escapeHtml(text) {
    return escapeHtml(text);
  }

  /**
   * Handle file selection from input
   */
  async handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    const MAX_FILES = 3;
    const currentCount = state.pendingAttachments.length;
    const newAttachments = [];

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        this.addErrorMessage(`❌ Arquivo "${file.name}" é muito grande (>5 MB).`);
        continue;
      }

      // JSON files: try to import as Design System before adding as attachment
      if (file.name.endsWith('.json')) {
        try {
          const text = await file.text();
          const imported = designSystemModule.importFromJSONString(text, file.name);
          if (imported) {
            // Successfully imported as design system — do not add to attachments
            continue;
          }
          // Not a design system JSON — fall through and attach normally as text
        } catch (_) {
          this.addErrorMessage(`❌ Erro ao ler "${file.name}".`);
          continue;
        }
      }

      // Validate total count
      if (currentCount + newAttachments.length >= MAX_FILES) {
        this.addErrorMessage(`❌ Máximo de ${MAX_FILES} arquivos por mensagem.`);
        break;
      }

      // Read file as base64
      const reader = new FileReader();
      const mimeType = file.type || this._guessMimeType(file.name);
      const type = this._guessFileType(mimeType);

      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        newAttachments.push({
          name: file.name,
          type,
          mimeType,
          size: file.size,
          dataUrl,
        });

        // Update state once all files are read
        if (newAttachments.length === files.length) {
          setState('pendingAttachments', [...state.pendingAttachments, ...newAttachments]);
        }
      };

      reader.onerror = () => {
        this.addErrorMessage(`❌ Erro ao ler arquivo "${file.name}".`);
      };

      reader.readAsDataURL(file);
    }
  }

  /**
   * Guess MIME type from filename
   */
  _guessMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeMap = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
      'csv': 'text/csv',
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  /**
   * Guess file type category from MIME type
   */
  _guessFileType(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'text/csv') return 'csv';
    return 'file';
  }

  /**
   * Render attachment preview strip
   */
  renderAttachmentPreview() {
    const preview = document.getElementById('attachmentPreview');
    const badge = document.getElementById('attachBadge');

    if (!preview || !badge) return;

    const attachments = state.pendingAttachments;

    if (attachments.length === 0) {
      preview.classList.add('hidden');
      badge.classList.add('hidden');
      return;
    }

    preview.classList.remove('hidden');
    badge.classList.remove('hidden');
    badge.textContent = attachments.length;

    preview.innerHTML = attachments.map((att, idx) => {
      const thumbHtml = att.type === 'image'
        ? `<img src="${this.escapeHtml(att.dataUrl)}" alt="${this.escapeHtml(att.name)}">`
        : `<span style="font-size: 14px;">${att.type === 'pdf' ? '📄' : '📊'}</span>`;

      return `
        <div class="attachment-chip">
          <div class="attachment-chip-thumbnail">${thumbHtml}</div>
          <span class="attachment-chip-name" title="${this.escapeHtml(att.name)}">${this.escapeHtml(att.name)}</span>
          <button class="attachment-chip-remove" data-idx="${idx}" title="Remover">×</button>
        </div>
      `;
    }).join('');

    // Wire up remove buttons
    preview.querySelectorAll('.attachment-chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const updated = state.pendingAttachments.filter((_, i) => i !== idx);
        setState('pendingAttachments', updated);
      });
    });
  }

  /**
   * Detect if message contains image generation keywords
   */
  _detectImageGenerationKeywords(text) {
    const keywords = [
      'gera imagem', 'cria imagem', 'generate image', 'create image',
      'desenha', 'draw', 'faça uma imagem', 'make an image',
      'imagem de', 'image of', 'crie uma', 'create a',
      'preciso de uma imagem', 'i need an image'
    ];
    const lowerText = text.toLowerCase();
    return keywords.some(kw => lowerText.includes(kw));
  }

  /**
   * Update image generation button visibility
   */
  updateImageGenerationButton() {
    const genImageBtn = document.getElementById('genImageBtn');
    const genImageSettingsBtn = document.getElementById('genImageSettingsBtn');
    const modelSelector = document.getElementById('modelSelector');
    if (!genImageBtn) return;

    const text = this.chatInput.value.trim();
    const shouldShow = text.length > 0 && this._detectImageGenerationKeywords(text);

    if (shouldShow) {
      genImageBtn.classList.remove('hidden');
      if (genImageSettingsBtn) genImageSettingsBtn.classList.remove('hidden');
      if (modelSelector) modelSelector.classList.remove('hidden');
    } else {
      genImageBtn.classList.add('hidden');
      if (genImageSettingsBtn) genImageSettingsBtn.classList.add('hidden');
      if (modelSelector) modelSelector.classList.add('hidden');
    }
  }

  /**
   * Handle explicit generate image button click
   */
  handleGenerateImageClick() {
    const prompt = this.chatInput.value.trim();
    if (!prompt) return;

    this.generateImage(prompt);
  }

  /**
   * Generate image using mockupApi and paste to canvas.
   * Reuses apiCall() from api.js (handles API_BASE, auth headers, credit errors).
   */
  async generateImage(prompt) {
    // Select model - default to 2.5 Flash
    const selectedModel = state.selectedModel || 'gemini-2.5-flash-image';

    // Parse frame size
    let width = 800, height = 450, aspectRatio = '16:9';
    const frameSize = state.selectedFrameSize;

    if (frameSize === 'custom') {
      width = state.customWidth || 800;
      height = state.customHeight || 450;
    } else {
      // Parse format: "16:9-800x450"
      const parts = frameSize.split('-');
      if (parts.length === 2) {
        aspectRatio = parts[0];
        const dims = parts[1].split('x');
        width = parseInt(dims[0]) || 800;
        height = parseInt(dims[1]) || 450;
      }
    }

    // Get resolution (for display)
    const resolution = state.selectedResolution || 'HD';

    this.setLoading(true);
    this.showTypingBubble();

    try {
      // Reuse apiCall() — centralised fetch with API_BASE, auth headers & credit handling
      const result = await apiCall('/mockups/generate', 'POST', {
        promptText: prompt,
        model: selectedModel,
        imagesCount: 1,
        aspectRatio,
        resolution,
        width,
        height
      });

      if (!result.imageBase64 && !result.imageUrl) {
        throw new Error('No image returned from generation');
      }

      // Get the image data — base64 is sent directly; URLs need fetching in sandbox
      const imageData = result.imageBase64 || result.imageUrl;
      const isUrl = !result.imageBase64 && !!result.imageUrl;

      // Add message to chat
      const modelLabel = selectedModel === 'gemini-3-pro-image-preview' ? '3 Pro' : '2.5 Flash';
      this.addAssistantMessage(`💎 Imagem ${width}×${height} gerada com ${modelLabel} (${resolution})`);

      // Auto-close settings panel and model selector
      const genImageSettingsPanel = document.getElementById('genImageSettingsPanel');
      const modelSelector = document.getElementById('modelSelector');
      if (genImageSettingsPanel) genImageSettingsPanel.classList.add('hidden');
      if (modelSelector) modelSelector.classList.add('hidden');

      // Send to plugin sandbox to paste on canvas
      parent.postMessage(
        {
          pluginMessage: {
            type: 'PASTE_GENERATED_IMAGE',
            imageData,
            isUrl,
            prompt,
            width,
            height
          }
        },
        'https://www.figma.com'
      );

      // Show credit notification
      if (result.creditsDeducted > 0) {
        const plural = result.creditsDeducted > 1 ? 's' : '';
        this.addAssistantMessage(`💳 ${result.creditsDeducted} crédito${plural} debitado`);
      }

    } catch (error) {
      this.removeTypingBubble();
      this.addErrorMessage(`❌ Erro ao gerar imagem: ${error.message}`);
      console.error('[ImageGeneration] Error:', error);
    } finally {
      this.setLoading(false);
      this.removeTypingBubble();
    }
  }
}

const chatModule = new ChatModule();
console.log('[ChatModule] Initialized. MentionsModule available:', typeof MentionsModule !== 'undefined');
