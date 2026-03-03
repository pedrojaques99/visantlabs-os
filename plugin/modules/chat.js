/**
 * Chat module - Handle chat UI and messaging
 * Best practice: Encapsulated chat logic, event-driven updates
 */

class ChatModule {
  constructor() {
    this.chatMessages = document.getElementById('chatMessages');
    this.chatInput = document.getElementById('chatInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.statusEl = document.getElementById('status');
    this.isLoading = false;

    this.setupEventListeners();
    this.setupStateListeners();
  }

  setupEventListeners() {
    // Send message on button click
    this.sendBtn.addEventListener('click', () => this.sendMessage());

    // Send on Enter key
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    this.chatInput.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
    });
  }

  setupStateListeners() {
    // Listen for chat history updates
    watchState('chatHistory', () => {
      this.renderMessages();
    });

    // Listen for loading state
    eventBus.on('chat:loading', (isLoading) => {
      this.setLoading(isLoading);
    });

    // Listen for API errors
    eventBus.on('api:error', (error) => {
      this.addErrorMessage(`Erro na API: ${error.error}`);
    });

    // Listen for design generated
    eventBus.on('api:design-generated', (result) => {
      this.addAssistantMessage(
        `Geradas ${result.operations.length} operações (usando ${result.provider || 'AI'})`
      );
      eventBus.emit('chat:operations-ready', result.operations);
    });
  }

  /**
   * Send user message
   */
  async sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message) return;

    // Clear input
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';

    // Add user message
    this.addUserMessage(message);

    // Request context and generate
    this.setLoading(true);
    try {
      generateWithContext(message, { fileId: state.sessionId });
    } catch (error) {
      this.addErrorMessage(`Falha ao enviar mensagem: ${error.message}`);
      this.setLoading(false);
    }
  }

  /**
   * Add user message to chat
   * @param {string} content - Message content
   */
  addUserMessage(content) {
    state.chatHistory.push({
      role: 'user',
      content,
      isError: false,
    });
    setState('chatHistory', state.chatHistory);
  }

  /**
   * Add assistant message
   * @param {string} content - Message content
   */
  addAssistantMessage(content) {
    state.chatHistory.push({
      role: 'assistant',
      content,
      isError: false,
    });
    setState('chatHistory', state.chatHistory);
  }

  /**
   * Add error message
   * @param {string} content - Error message
   */
  addErrorMessage(content) {
    state.chatHistory.push({
      role: 'assistant',
      content,
      isError: true,
    });
    setState('chatHistory', state.chatHistory);
  }

  /**
   * Render all messages
   */
  renderMessages() {
    this.chatMessages.innerHTML = '';

    for (const msg of state.chatHistory) {
      const el = document.createElement('div');
      el.className = `chat-message ${msg.role}${msg.isError ? ' error' : ''}`;

      if (msg.role === 'assistant') {
        el.innerHTML = `
          <div class="message-avatar">AI</div>
          <div class="message-body">${this.escapeHtml(msg.content)}</div>
        `;
      } else {
        el.innerHTML = `
          <div class="message-body">${this.escapeHtml(msg.content)}</div>
          <div class="message-avatar">👤</div>
        `;
      }

      this.chatMessages.appendChild(el);
    }

    // Auto-scroll to bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  /**
   * Set loading state
   * @param {boolean} isLoading - Loading state
   */
  setLoading(isLoading) {
    this.isLoading = isLoading;
    this.sendBtn.disabled = isLoading;
    this.chatInput.disabled = isLoading;

    if (isLoading) {
      this.statusEl.textContent = '⏳ Gerando operações...';
      this.statusEl.classList.remove('hidden');
    } else {
      this.statusEl.classList.add('hidden');
    }
  }

  /**
   * Clear chat history
   */
  clearHistory() {
    if (confirm('Limpar histórico de chat?')) {
      setState('chatHistory', [
        {
          role: 'assistant',
          content:
            'Olá! Descreva o que quer criar ou modificar. Configure as Brand Guidelines em ⚙ Configurações.',
          isError: false,
        },
      ]);
      setState('sessionId', (window.crypto && typeof window.crypto.randomUUID === 'function') ? window.crypto.randomUUID() : 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36));
    }
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

const chatModule = new ChatModule();
