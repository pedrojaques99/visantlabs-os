// plugin/modules/brandUI.js
class BrandUIModule {
  constructor() {
    this._container = null
  }

  init() {
    this._container = document.getElementById('brand-v2-panel')
    if (!this._container) return

    this._render()

    // Re-render when brandGuideline state changes
    window.watchState('brandGuideline', () => this._render())
  }

  async _render() {
    if (!this._container) return
    const bg = window.getState('brandGuideline')
    const token = window.getState('authToken')

    if (!token) {
      this._container.innerHTML = '<div class="figma-prop-section"><p class="hint-text">Login to manage brand guidelines.</p></div>'
      return
    }

    if (!bg) {
      // Show guideline list / create new
      await this._renderList()
      return
    }

    // Show active guideline
    this._renderGuideline(bg)
  }

  async _renderList() {
    this._container.innerHTML = '<div class="figma-prop-section"><p class="hint-text">Loading guidelines...</p></div>'

    const list = await window.brandSyncModule.fetchList()
    let html = '<div class="figma-prop-section">'
    html += '<div class="figma-prop-section-title">Brand Guidelines</div>'

    if (list.length === 0) {
      html += '<p class="hint-text">No brand guidelines yet.</p>'
    } else {
      for (const g of list) {
        const name = g.identity?.name || 'Unnamed'
        const completeness = g.extraction?.completeness || 0
        html += `<div class="bg-list-item" data-id="${this._esc(g._id || g.id)}">
          <span class="bg-list-name">${this._esc(name)}</span>
          <span class="bg-list-completeness">${completeness}%</span>
        </div>`
      }
    }

    html += `<button class="figma-button figma-button--secondary bg-create-btn" style="margin-top:8px;width:100%;">+ New Brand</button>`
    html += '</div>'
    this._container.innerHTML = html

    // Event: select guideline
    this._container.querySelectorAll('.bg-list-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id')
        if (id) window.brandSyncModule.select(id)
      })
    })

    // Event: create new
    const createBtn = this._container.querySelector('.bg-create-btn')
    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        const guideline = await window.brandSyncModule.create()
        if (guideline) window.brandSyncModule.select(guideline._id || guideline.id)
      })
    }
  }

  _renderGuideline(bg) {
    const name = bg.identity?.name || 'Unnamed'
    const completeness = bg.extraction?.completeness || 0
    let html = ''

    // Header with back button
    html += `<div class="figma-prop-section">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <button class="figma-button figma-button--secondary bg-back-btn" style="padding:4px 8px;">←</button>
        <div class="figma-prop-section-title" style="margin:0;">${this._esc(name)}</div>
        <span class="bg-list-completeness" style="margin-left:auto;">${completeness}%</span>
      </div>
    </div>`

    // Ingest banner
    html += `<div class="figma-prop-section bg-ingest-banner">
      <div class="figma-prop-section-title">Import Sources</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        <button class="figma-button figma-button--secondary bg-ingest-btn" data-source="url" style="flex:1;min-width:60px;">URL</button>
        <button class="figma-button figma-button--secondary bg-ingest-btn" data-source="json" style="flex:1;min-width:60px;">JSON</button>
        <button class="figma-button figma-button--secondary bg-ingest-btn" data-source="pdf" style="flex:1;min-width:60px;">PDF</button>
        <button class="figma-button figma-button--secondary bg-ingest-btn" data-source="image" style="flex:1;min-width:60px;">Image</button>
      </div>
    </div>`

    // Identity
    html += `<div class="figma-prop-section">
      <div class="figma-prop-section-title">Identity</div>
      <div class="figma-prop-row"><label>Name</label><input type="text" class="figma-input bg-field" data-field="identity.name" value="${this._esc(bg.identity?.name || '')}" /></div>
      <div class="figma-prop-row"><label>Website</label><input type="text" class="figma-input bg-field" data-field="identity.website" value="${this._esc(bg.identity?.website || '')}" /></div>
      <div class="figma-prop-row"><label>Tagline</label><input type="text" class="figma-input bg-field" data-field="identity.tagline" value="${this._esc(bg.identity?.tagline || '')}" /></div>
    </div>`

    // Colors
    html += `<div class="figma-prop-section">
      <div class="figma-prop-section-title">Colors</div>
      <div class="bg-color-grid">`
    if (bg.colors?.length) {
      for (let i = 0; i < bg.colors.length; i++) {
        const c = bg.colors[i]
        html += `<div class="bg-color-swatch" style="background:${this._esc(c.hex)}" title="${this._esc(c.name)} ${this._esc(c.hex)}">
          <button class="bg-remove-btn" data-action="remove-color" data-index="${i}">×</button>
        </div>`
      }
    }
    html += `</div>
      <button class="figma-button figma-button--secondary bg-add-color-btn" style="margin-top:4px;width:100%;">+ Add Color</button>
    </div>`

    // Typography
    html += `<div class="figma-prop-section">
      <div class="figma-prop-section-title">Typography</div>`
    if (bg.typography?.length) {
      for (let i = 0; i < bg.typography.length; i++) {
        const t = bg.typography[i]
        html += `<div class="bg-typo-item">
          <span>${this._esc(t.family)} ${this._esc(t.style || '')} <small>(${this._esc(t.role)})</small></span>
          <button class="bg-remove-btn" data-action="remove-typo" data-index="${i}">×</button>
        </div>`
      }
    }
    html += `<button class="figma-button figma-button--secondary bg-add-typo-btn" style="margin-top:4px;width:100%;">+ Add Font</button>
    </div>`

    // Guidelines (voice)
    html += `<div class="figma-prop-section">
      <div class="figma-prop-section-title">Voice & Tone</div>
      <textarea class="figma-input bg-field" data-field="guidelines.voice" rows="3" placeholder="Describe brand voice...">${this._esc(bg.guidelines?.voice || '')}</textarea>
    </div>`

    // Delete button
    html += `<div class="figma-prop-section">
      <button class="figma-button figma-button--secondary bg-delete-btn" style="width:100%;color:var(--figma-color-text-danger);">Delete Brand Guideline</button>
    </div>`

    this._container.innerHTML = html
    this._bindGuidelineEvents(bg)
  }

  _bindGuidelineEvents(bg) {
    // Back button
    const backBtn = this._container.querySelector('.bg-back-btn')
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.setState('brandGuideline', null)
        window.brandSyncModule._selectedId = null
      })
    }

    // Field inputs (identity, voice)
    this._container.querySelectorAll('.bg-field').forEach(el => {
      el.addEventListener('change', () => {
        const field = el.getAttribute('data-field')
        if (!field) return
        const current = window.getState('brandGuideline')
        if (!current) return
        const updated = JSON.parse(JSON.stringify(current))
        const parts = field.split('.')
        let target = updated
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) target[parts[i]] = {}
          target = target[parts[i]]
        }
        target[parts[parts.length - 1]] = el.value
        window.setState('brandGuideline', updated)
      })
    })

    // Ingest buttons
    this._container.querySelectorAll('.bg-ingest-btn').forEach(el => {
      el.addEventListener('click', async () => {
        const source = el.getAttribute('data-source')
        if (source === 'url') {
          const url = prompt('Enter website URL:')
          if (url) {
            el.textContent = '...'
            try {
              await window.brandSyncModule.ingest('url', { url })
            } catch (e) { alert('Ingest failed: ' + e.message) }
            el.textContent = 'URL'
          }
        } else if (source === 'json' || source === 'pdf' || source === 'image') {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = source === 'json' ? '.json' : source === 'pdf' ? '.pdf' : 'image/*'
          input.onchange = async () => {
            const file = input.files[0]
            if (!file) return
            el.textContent = '...'
            const reader = new FileReader()
            reader.onload = async () => {
              try {
                await window.brandSyncModule.ingest(source, { data: reader.result, filename: file.name })
              } catch (e) { alert('Ingest failed: ' + e.message) }
              el.textContent = source.toUpperCase()
            }
            reader.readAsDataURL(file)
          }
          input.click()
        }
      })
    })

    // Remove color
    this._container.querySelectorAll('[data-action="remove-color"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        const idx = parseInt(el.getAttribute('data-index'))
        const current = window.getState('brandGuideline')
        if (!current?.colors) return
        const updated = JSON.parse(JSON.stringify(current))
        updated.colors.splice(idx, 1)
        window.setState('brandGuideline', updated)
      })
    })

    // Add color
    const addColorBtn = this._container.querySelector('.bg-add-color-btn')
    if (addColorBtn) {
      addColorBtn.addEventListener('click', () => {
        const hex = prompt('Enter hex color (e.g. #FF5500):')
        if (!hex || !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) return
        const name = prompt('Color name:') || hex
        const current = window.getState('brandGuideline')
        if (!current) return
        const updated = JSON.parse(JSON.stringify(current))
        updated.colors = updated.colors || []
        updated.colors.push({ hex: hex.toUpperCase(), name, role: '' })
        window.setState('brandGuideline', updated)
      })
    }

    // Remove typography
    this._container.querySelectorAll('[data-action="remove-typo"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        const idx = parseInt(el.getAttribute('data-index'))
        const current = window.getState('brandGuideline')
        if (!current?.typography) return
        const updated = JSON.parse(JSON.stringify(current))
        updated.typography.splice(idx, 1)
        window.setState('brandGuideline', updated)
      })
    })

    // Add typography
    const addTypoBtn = this._container.querySelector('.bg-add-typo-btn')
    if (addTypoBtn) {
      addTypoBtn.addEventListener('click', () => {
        const family = prompt('Font family (e.g. Inter):')
        if (!family) return
        const role = prompt('Role (heading, body, accent, mono):') || 'body'
        const style = prompt('Style (Regular, Bold, SemiBold):') || 'Regular'
        const current = window.getState('brandGuideline')
        if (!current) return
        const updated = JSON.parse(JSON.stringify(current))
        updated.typography = updated.typography || []
        updated.typography.push({ family, style, role })
        window.setState('brandGuideline', updated)
      })
    }

    // Delete guideline
    const deleteBtn = this._container.querySelector('.bg-delete-btn')
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm('Delete this brand guideline permanently?')) return
        const current = window.getState('brandGuideline')
        if (current?._id) await window.brandSyncModule.remove(current._id)
      })
    }
  }

  _esc(str) {
    if (!str) return ''
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
}

window.brandUIModule = new BrandUIModule()
