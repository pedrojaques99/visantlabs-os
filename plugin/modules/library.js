/**
 * Library module - Component library and folder management
 * Best practice: Encapsulated library UI logic
 */

class LibraryModule {
  constructor() {
    this.componentsLibrary = document.getElementById('componentsLibrary');
    this.componentSearch = document.getElementById('componentSearch');
    this.showFoldersBtn = document.getElementById('showFoldersBtn');

    this.setupEventListeners();
    this.setupStateListeners();
  }

  setupEventListeners() {
    // Search
    this.componentSearch?.addEventListener('input', (e) => {
      this.filterComponents(e.target.value);
    });

    // Toggle folder view
    this.showFoldersBtn?.addEventListener('click', () => {
      const next = !state.showFolders;
      setState('showFolders', next);
      this.showFoldersBtn.setAttribute('aria-pressed', String(next));
      this.showFoldersBtn.classList.toggle('is-active', next);
      this.render();
    });
  }

  setupStateListeners() {
    watchState('allComponents', () => {
      this.render();
    });

    watchState('showFolders', () => {
      this.render();
    });

    watchState('expandedFolders', () => {
      this.render();
    });

    // Listen for component data from sandbox
    eventBus.on('context:components-loaded', (components) => {
      setState('allComponents', components);
    });

    eventBus.on('component:thumbnail-loaded', (data) => {
      state.componentThumbs[data.componentId] = data.thumbnail;
      this.render();
    });
  }

  /**
   * Render component library
   */
  render() {
    if (!this.componentsLibrary) return;

    if (state.allComponents.length === 0) {
      this.componentsLibrary.innerHTML =
        '<div class="text-muted">Nenhum componente encontrado no arquivo</div>';
      return;
    }

    if (state.showFolders) {
      this.renderFolderView();
    } else {
      this.renderListView();
    }
  }

  /**
   * Render as folder tree
   */
  renderFolderView() {
    const folders = this.buildFolderTree(state.allComponents);
    this.componentsLibrary.innerHTML = '';

    for (const [folderPath, components] of Object.entries(folders)) {
      this.renderFolder(folderPath, components);
    }
  }

  /**
   * Build folder tree from components
   */
  buildFolderTree(components) {
    const folders = {};

    for (const comp of components) {
      const path = comp.folderPath?.join(' / ') || 'Root';
      if (!folders[path]) {
        folders[path] = [];
      }
      folders[path].push(comp);
    }

    return folders;
  }

  /**
   * Render a folder section
   */
  renderFolder(folderPath, components) {
    const folderEl = document.createElement('div');
    folderEl.className = 'folder-section';

    const folderId = folderPath.replace(/\s/g, '_');
    const isExpanded = state.expandedFolders.has(folderId);

    // Folder header
    const header = document.createElement('div');
    header.className = 'folder-header';
    header.innerHTML = `
      <span class="folder-toggle">${isExpanded ? '▼' : '▶'}</span>
      <span class="folder-name">${this.escapeHtml(folderPath)}</span>
      <span class="folder-count">${components.length}</span>
    `;

    header.addEventListener('click', () => {
      const newExpanded = new Set(state.expandedFolders);
      if (isExpanded) {
        newExpanded.delete(folderId);
      } else {
        newExpanded.add(folderId);
      }
      setState('expandedFolders', newExpanded);
    });

    folderEl.appendChild(header);

    // Components list (shown if expanded)
    if (isExpanded) {
      const list = document.createElement('div');
      list.className = 'folder-items';

      for (const comp of components) {
        list.appendChild(this.renderComponentItem(comp));
      }

      folderEl.appendChild(list);
    }

    this.componentsLibrary.appendChild(folderEl);
  }

  /**
   * Render as simple list
   */
  renderListView() {
    this.componentsLibrary.innerHTML = '';

    for (const comp of state.allComponents) {
      this.componentsLibrary.appendChild(this.renderComponentItem(comp));
    }
  }

  /**
   * Render single component item
   */
  renderComponentItem(comp) {
    const div = document.createElement('div');
    div.className = 'component-item';

    const thumb = state.componentThumbs[comp.id];
    const thumbHtml = thumb
      ? `<img class="comp-thumb" src="${thumb}" alt="">`
      : '<div class="comp-icon">◇</div>';

    div.innerHTML = `
      ${thumbHtml}
      <div class="comp-info">
        <div class="comp-name" title="${this.escapeHtml(comp.name)}">${this.escapeHtml(comp.name)}</div>
        <div class="comp-key" title="${this.escapeHtml(comp.key)}">${this.escapeHtml(comp.key)}</div>
      </div>
    `;

    div.addEventListener('click', () => {
      eventBus.emit('library:component-selected', comp);
    });

    return div;
  }

  /**
   * Filter components by search
   */
  filterComponents(query) {
    if (!query) {
      this.render();
      return;
    }

    const filtered = state.allComponents.filter((c) =>
      c.name.toLowerCase().includes(query.toLowerCase())
    );

    this.componentsLibrary.innerHTML = '';
    for (const comp of filtered) {
      this.componentsLibrary.appendChild(this.renderComponentItem(comp));
    }
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    return escapeHtml(text);
  }
}

const libraryModule = new LibraryModule();
