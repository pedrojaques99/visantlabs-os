/**
 * BrandColors — Essentialist color management with preset role slots.
 *
 * Instead of free-form color lists, we expose the exact 6 roles that
 * `brandApply.ts` consumes. Each slot is a "card" the user clicks to
 * open a native color picker. This makes the brand-apply deterministic:
 * no guessing which color plays which role.
 *
 * Role slots (match brandApply.ts expectations):
 *   primary    — main brand color (fills on mid-tone shapes)
 *   secondary  — supporting brand color
 *   accent     — highlights, stars, CTAs
 *   background — page background (defaults #FFFFFF)
 *   surface    — cards/panels (defaults #F5F5F5)
 *   text       — body copy (defaults #333333)
 *
 * Extras: free-form colors the user adds on top. They're stored with
 * role='' and don't affect brand-apply directly but are preserved for
 * export/push to webapp.
 *
 * State shape is unchanged (Map<id, {name,value,role}>), so the rest
 * of the plugin (export, sync, brandApply) keeps working as-is.
 */

const BRAND_COLOR_ROLES = [
  { id: 'primary', label: 'Primary', hint: 'Main brand color', defaultHex: '#6366F1' },
  { id: 'secondary', label: 'Secondary', hint: 'Supporting color', defaultHex: '#8B5CF6' },
  { id: 'accent', label: 'Accent', hint: 'Highlights & CTAs', defaultHex: '#F59E0B' },
  { id: 'background', label: 'Background', hint: 'Page background', defaultHex: '#FFFFFF' },
  { id: 'surface', label: 'Surface', hint: 'Cards & panels', defaultHex: '#F5F5F5' },
  { id: 'text', label: 'Text', hint: 'Body copy', defaultHex: '#111827' },
];

class BrandColors {
  constructor() {
    this.colorGrid = document.getElementById('colorGrid');
    this.extrasList = document.getElementById('colorExtrasList');
    this.availableColorsList = document.getElementById('availableColorsList');
    this.activeRole = null; // tracking which slot we are currently picking for
    this._hiddenPicker = null;
    this._ensureHiddenPicker();
  }

  /** Hidden color picker we programmatically click when a slot is tapped. */
  _ensureHiddenPicker() {
    if (this._hiddenPicker) return;
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:0;height:0;';
    document.body.appendChild(picker);
    this._hiddenPicker = picker;
  }

  /** Get color currently assigned to a role, or null. */
  _getByRole(role) {
    if (!(state.selectedColors instanceof Map)) return null;
    for (const [id, c] of state.selectedColors) {
      if (c.role === role) return { id, ...c };
    }
    return null;
  }

  /** Set/replace a role's color. Pass null to clear. */
  _setRole(role, hex, name) {
    const colors = state.selectedColors instanceof Map
      ? new Map(state.selectedColors)
      : new Map();

    // Remove any existing entry for this role
    for (const [id, c] of colors) {
      if (c.role === role) colors.delete(id);
    }

    if (hex) {
      const id = `role-${role}`;
      colors.set(id, {
        id,
        name: name || BRAND_COLOR_ROLES.find(r => r.id === role)?.label || role,
        value: hex,
        role,
      });
    }
    setState('selectedColors', colors);
  }

  /** Pick/Toggle active role for selection from library/picker. */
  _pickForRole(role) {
    if (this.activeRole === role) {
      this.activeRole = null; // Toggle off
    } else {
      this.activeRole = role;
      // Show library when a role is clicked, to encourage picking from it
      if (this.availableColorsList) {
        this.availableColorsList.classList.remove('hidden');
        if (!state.allColors || state.allColors.length === 0) {
          getContext(); // Refresh from Figma if empty
        }
      }
    }
    this.render();
    if (this.availableColorsList && !this.availableColorsList.classList.contains('hidden')) {
      this.renderAvailableColors();
    }
  }

  /** Trigger native picker for currently active role or specified role. */
  _openNativePicker(role) {
    const targetRole = role || this.activeRole;
    if (!targetRole) return;

    const current = this._getByRole(targetRole);
    const roleDef = BRAND_COLOR_ROLES.find(r => r.id === targetRole);
    const startHex = current?.value || roleDef?.defaultHex || '#6366F1';
    const picker = this._hiddenPicker;
    picker.value = startHex;

    const onChange = () => {
      picker.removeEventListener('change', onChange);
      this._setRole(targetRole, picker.value, current?.name);
      this.activeRole = null;
      this.render();
    };
    picker.addEventListener('change', onChange);
    picker.click();
  }

  /** Add a free-form extra color (not tied to a role). */
  addExtra() {
    const picker = this._hiddenPicker;
    picker.value = '#6366F1';
    const onChange = () => {
      picker.removeEventListener('change', onChange);
      const hex = picker.value;
      const colors = state.selectedColors instanceof Map
        ? new Map(state.selectedColors)
        : new Map();
      const id = `extra-${Date.now()}`;
      colors.set(id, { id, name: hex, value: hex, role: '' });
      setState('selectedColors', colors);
    };
    picker.addEventListener('change', onChange);
    picker.click();
  }

  /** Rename a color (extras only — roles keep their semantic label). */
  _rename(id, newName) {
    const colors = new Map(state.selectedColors);
    const c = colors.get(id);
    if (!c) return;
    c.name = newName || c.value;
    setState('selectedColors', colors);
  }

  /** Remove a color by id. */
  _remove(id) {
    const colors = new Map(state.selectedColors);
    colors.delete(id);
    setState('selectedColors', colors);
  }

  /** Import from a library swatch. */
  pickFromLibrary(color) {
    const roleToFill = this.activeRole || this._findFirstEmptyRole();

    if (roleToFill) {
      this._setRole(roleToFill, color.value, color.name);
      this.activeRole = null; // Clear after filling
      this.render();
    } else {
      // Add as extra if no active role and all roles filled
      const colors = state.selectedColors instanceof Map
        ? new Map(state.selectedColors)
        : new Map();
      const id = `lib-${Date.now()}`;
      colors.set(id, { id, name: color.name || color.value, value: color.value, role: '' });
      setState('selectedColors', colors);
    }
  }

  /** Helper to find the first empty slot to auto-fill. */
  _findFirstEmptyRole() {
    for (const roleDef of BRAND_COLOR_ROLES) {
      if (!this._getByRole(roleDef.id)) return roleDef.id;
    }
    return null;
  }

  /** Render available colors list (library) — logic moved here for better cohesion. */
  renderAvailableColors() {
    if (!this.availableColorsList) return;
    const list = this.availableColorsList;
    list.innerHTML = '';

    // Add header/title
    const header = document.createElement('div');
    header.className = 'available-colors-header';
    header.innerHTML = `
      <span style="font-weight: 600; font-size: 10px; color: var(--figma-color-text-secondary);">LIBRARY COLORS</span>
      <button class="figma-icon-btn" id="closeLibraryBtn" style="font-size: 12px;">×</button>
    `;
    header.querySelector('#closeLibraryBtn').addEventListener('click', () => {
      list.classList.add('hidden');
      this.activeRole = null;
      this.render();
    });
    list.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'available-colors-grid';

    // Add "Custom Color" option at the start
    const customDiv = document.createElement('div');
    customDiv.className = 'available-color-item custom';
    customDiv.innerHTML = `
      <div class="available-color-swatch-ring" style="border: 1px dashed var(--figma-color-border-strong);">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 3v6M3 6h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
      </div>
      <span class="available-color-name">Custom</span>
    `;
    customDiv.addEventListener('click', () => this._openNativePicker());
    grid.appendChild(customDiv);

    const colors = state.allColors || [];
    for (const color of colors) {
      const div = document.createElement('div');
      div.className = 'available-color-item';
      div.innerHTML = `
        <div class="available-color-swatch-ring">
          <div class="available-color-swatch" style="background: ${color.value}"></div>
        </div>
        <span class="available-color-name" title="${color.name}">${color.name}</span>
      `;
      div.addEventListener('click', () => this.pickFromLibrary(color));
      grid.appendChild(div);
    }

    if (colors.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.padding = '12px';
      empty.textContent = 'Nenhuma cor encontrada na seleção/arquivo.';
      list.appendChild(empty);
    } else {
      list.appendChild(grid);
    }
  }

  /** Main render — 6 role slots + extras row. */
  render() {
    if (!this.colorGrid) return;
    this.colorGrid.className = 'brand-role-grid';
    this.colorGrid.innerHTML = '';

    for (const roleDef of BRAND_COLOR_ROLES) {
      const current = this._getByRole(roleDef.id);
      const isActive = this.activeRole === roleDef.id;

      const card = document.createElement('div');
      card.className = 'brand-role-slot' + (current ? ' filled' : ' empty') + (isActive ? ' active' : '');
      card.dataset.role = roleDef.id;

      const swatchStyle = current
        ? `background:${current.value};`
        : `background:repeating-linear-gradient(45deg, var(--figma-color-bg-secondary,#f5f5f5), var(--figma-color-bg-secondary,#f5f5f5) 4px, var(--figma-color-bg,#fff) 4px, var(--figma-color-bg,#fff) 10px);`;

      card.innerHTML = `
        <button class="brand-role-swatch" style="${swatchStyle}" title="${roleDef.hint}">
          ${(current || isActive) ? '' : `
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" style="opacity:0.4">
              <path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          `}
          ${isActive ? `
            <div class="active-ring"></div>
          ` : ''}
        </button>
        <div class="brand-role-meta">
          <div class="brand-role-label">${roleDef.label}</div>
          <div class="brand-role-value">${current ? current.value.toUpperCase() : roleDef.hint}</div>
        </div>
        ${current ? `
          <button class="figma-icon-btn brand-role-clear" title="Limpar">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
          </button>
        ` : ''}
      `;

      card.querySelector('.brand-role-swatch').addEventListener('click', () => {
        this._pickForRole(roleDef.id);
      });
      card.querySelector('.brand-role-clear')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this._setRole(roleDef.id, null);
      });

      this.colorGrid.appendChild(card);
    }

    this._renderExtras();
  }

  /** Render extras strip below the role grid. */
  _renderExtras() {
    if (!this.extrasList) return;
    this.extrasList.innerHTML = '';

    const extras = [];
    if (state.selectedColors instanceof Map) {
      for (const [id, c] of state.selectedColors) {
        if (!c.role) extras.push({ id, ...c });
      }
    }

    if (extras.length === 0) {
      this.extrasList.classList.add('hidden');
      return;
    }
    this.extrasList.classList.remove('hidden');

    for (const c of extras) {
      const chip = document.createElement('div');
      chip.className = 'brand-extra-chip';
      chip.innerHTML = `
        <div class="brand-extra-swatch" style="background:${c.value}" title="${escapeHtml(c.name)}"></div>
        <div class="brand-extra-label" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
        <button class="figma-icon-btn brand-extra-remove" title="Remover">
          <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      `;
      chip.querySelector('.brand-extra-remove').addEventListener('click', () => this._remove(c.id));
      this.extrasList.appendChild(chip);
    }
  }
}

window.BrandColors = BrandColors;
window.BRAND_COLOR_ROLES = BRAND_COLOR_ROLES;
