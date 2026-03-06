/**
 * Mentions module - @mentions autocomplete for layers, frames, and variables
 * Provides dropdown menu to select and reference Figma elements in chat
 */

console.log('[MentionsModule] Loading...');

class MentionsModule {
  constructor() {
    this.chatInput = document.getElementById('chatInput');
    this.menuEl = null;
    this.isOpen = false;
    this.currentMention = null;
    this.selectedIdx = -1;
    this.availableElements = [];
    this.lastSearchTerm = '';

    // Cache for Figma elements
    this.figmaElements = {
      layers: [],
      frames: [],
      variables: [],
      components: [],
    };

    this.setupInputListener();
    this.createMenuElement();
  }

  /**
   * Create the mentions dropdown menu element
   */
  createMenuElement() {
    this.menuEl = document.createElement('div');
    this.menuEl.className = 'mentions-menu hidden';
    this.menuEl.id = 'mentionsMenu';
    document.body.appendChild(this.menuEl);

    // Event delegation for menu items
    this.menuEl.addEventListener('click', (e) => {
      const item = e.target.closest('.mention-item');
      if (item) {
        const elementId = item.dataset.elementId;
        const elementName = item.dataset.elementName;
        const elementType = item.dataset.elementType;
        this.selectMention(elementId, elementName, elementType);
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIdx = Math.min(this.selectedIdx + 1, this.availableElements.length - 1);
        this.updateMenuSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIdx = Math.max(this.selectedIdx - 1, 0);
        this.updateMenuSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.selectedIdx >= 0 && this.availableElements[this.selectedIdx]) {
          const elem = this.availableElements[this.selectedIdx];
          this.selectMention(elem.elementId, elem.elementName, elem.elementType);
        }
      } else if (e.key === 'Escape') {
        this.closeMentions();
      }
    });
  }

  /**
   * Setup input listener for @mentions
   */
  setupInputListener() {
    this.chatInput.addEventListener('input', (e) => {
      const text = this.chatInput.value;
      const cursorPos = this.chatInput.selectionStart;

      // Find the last @ before cursor
      const beforeCursor = text.substring(0, cursorPos);
      const lastAtIndex = beforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1 && lastAtIndex === beforeCursor.length - 1) {
        // Just typed @
        this.openMentions();
        this.currentMention = { startPos: lastAtIndex };
      } else if (lastAtIndex !== -1) {
        // Already have @ and typing after it
        const afterAt = beforeCursor.substring(lastAtIndex + 1);

        // Stop if we hit a space after @ (allow accented/unicode letters)
        if (/\s/.test(afterAt.slice(-1)) && afterAt.length > 0) {
          this.closeMentions();
        } else {
          // Ensure menu is open (handles case where @ was typed and data is still loading)
          if (!this.isOpen) this.openMentions();
          // Filter by search term
          const searchTerm = afterAt;
          this.filterMentions(searchTerm);
          this.currentMention = { startPos: lastAtIndex, searchTerm };
        }
      } else {
        this.closeMentions();
      }
    });
  }

  /**
   * Open mentions menu and request Figma elements
   */
  openMentions() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.selectedIdx = -1;
    this.lastSearchTerm = '';
    this.requestFigmaElements();
  }

  /**
   * Close mentions menu
   */
  closeMentions() {
    this.isOpen = false;
    this.currentMention = null;
    this.selectedIdx = -1;
    this.menuEl.classList.add('hidden');
    this.availableElements = [];
  }

  /**
   * Request Figma elements from plugin sandbox
   */
  requestFigmaElements() {
    parent.postMessage(
      { pluginMessage: { type: 'GET_ELEMENTS_FOR_MENTIONS' } },
      '*'
    );
  }

  /**
   * Handle response from plugin with Figma elements
   */
  handleFigmaElements(data) {
    this.figmaElements = data || {
      layers: [],
      frames: [],
      variables: [],
      components: [],
    };

    // Flatten into one list with type info
    this.availableElements = [
      ...this.figmaElements.components.map(c => ({
        elementId: c.id,
        elementName: c.name,
        elementType: 'component',
        icon: '📦',
      })),
      ...this.figmaElements.frames.map(f => ({
        elementId: f.id,
        elementName: f.name,
        elementType: 'frame',
        icon: '📐',
      })),
      ...this.figmaElements.layers.map(l => ({
        elementId: l.id,
        elementName: l.name,
        elementType: 'layer',
        icon: '📑',
      })),
      ...this.figmaElements.variables.map(v => ({
        elementId: v.id,
        elementName: v.name,
        elementType: 'variable',
        icon: '🔤',
      })),
    ];

    if (this.availableElements.length > 0) {
      // Re-filter using current search term to fix race condition
      // (user may have typed filter text before data arrived)
      if (this.lastSearchTerm) {
        this.filterMentions(this.lastSearchTerm);
      } else {
        this.renderMenu('');
      }
    }
  }

  /**
   * Filter mentions by search term
   */
  filterMentions(searchTerm) {
    this.lastSearchTerm = searchTerm.toLowerCase();
    this.selectedIdx = -1;

    if (searchTerm.length === 0) {
      this.renderMenu('');
    } else {
      const filtered = this.availableElements.filter(el =>
        el.elementName.toLowerCase().includes(this.lastSearchTerm)
      );
      this.renderMenu(searchTerm, filtered);
    }
  }

  /**
   * Render the mentions menu
   */
  renderMenu(searchTerm, elements = null) {
    const itemsToShow = elements !== null ? elements : this.availableElements;

    if (itemsToShow.length === 0) {
      this.menuEl.innerHTML = '<div class="mention-empty">Nenhum elemento encontrado</div>';
      this.menuEl.classList.remove('hidden');
      return;
    }

    let html = `<div class="mention-search">${searchTerm ? `"${this.escapeHtml(searchTerm)}"` : '...'}</div>`;
    html += '<div class="mention-list">';

    itemsToShow.slice(0, 15).forEach((el, idx) => {
      const isSelected = idx === this.selectedIdx ? ' selected' : '';
      html += `
        <div class="mention-item${isSelected}" data-element-id="${this.escapeHtml(el.elementId)}" data-element-name="${this.escapeHtml(el.elementName)}" data-element-type="${el.elementType}">
          <span class="mention-icon">${el.icon}</span>
          <span class="mention-name">${this.escapeHtml(el.elementName)}</span>
          <span class="mention-type">${el.elementType}</span>
        </div>
      `;
    });

    html += '</div>';
    this.menuEl.innerHTML = html;
    this.menuEl.classList.remove('hidden');
    this.positionMenu();
  }

  /**
   * Update menu selection highlighting
   */
  updateMenuSelection() {
    const items = this.menuEl.querySelectorAll('.mention-item');
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === this.selectedIdx);
    });

    // Scroll into view
    if (items[this.selectedIdx]) {
      items[this.selectedIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Position menu near chat input
   */
  positionMenu() {
    const rect = this.chatInput.getBoundingClientRect();
    const menuHeight = Math.min(this.menuEl.scrollHeight, 250);
    // Position above input, but clamp to viewport
    let top = rect.top - menuHeight - 4;
    if (top < 4) top = 4;
    this.menuEl.style.position = 'fixed';
    this.menuEl.style.left = rect.left + 'px';
    this.menuEl.style.top = top + 'px';
    this.menuEl.style.width = Math.min(300, rect.width) + 'px';
    this.menuEl.style.maxHeight = (rect.top - 8) + 'px';
  }

  /**
   * Select a mention and insert into input
   */
  selectMention(elementId, elementName, elementType) {
    const cursorPos = this.chatInput.selectionStart;
    const text = this.chatInput.value;
    const beforeCursor = text.substring(0, cursorPos);
    const afterCursor = text.substring(cursorPos);

    const lastAtIndex = beforeCursor.lastIndexOf('@');
    if (lastAtIndex === -1) return;

    // Replace @searchterm with @"name"[type:id]
    const before = text.substring(0, lastAtIndex);
    const mention = `@"${elementName}"[${elementType}:${elementId}]`;
    const newText = before + mention + afterCursor;

    this.chatInput.value = newText;
    this.chatInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Set cursor after mention
    const newCursorPos = before.length + mention.length;
    setTimeout(() => {
      this.chatInput.selectionStart = newCursorPos;
      this.chatInput.selectionEnd = newCursorPos;
      this.chatInput.focus();
    }, 0);

    this.closeMentions();
  }

  /**
   * Extract mentions from message text
   * Returns: { mentions: [{id, name, type}], cleanText: "..." }
   */
  static extractMentions(text) {
    const mentions = [];
    const mentionRegex = /@"([^"]+)"\[(.*?):(.*?)\]/g;

    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push({
        name: match[1],
        type: match[2],
        id: match[3],
      });
    }

    // Remove mention syntax for display
    const cleanText = text.replace(mentionRegex, '@"$1"');

    return { mentions, cleanText };
  }

  escapeHtml(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

const mentionsModule = new MentionsModule();
console.log('[MentionsModule] Loaded successfully:', mentionsModule);
