// plugin/modules/brandSync.js
class BrandSyncModule {
  constructor() {
    this._syncTimer = null
    this._fileId = null
    this._selectedId = null // active guideline ID for this Figma file
    this._isLinkedFromCanvas = false // true when auto-loaded from Canvas
  }

  init(fileId) {
    this._fileId = fileId || 'default'
    // Load selected guideline ID from Figma file cache
    parent.postMessage({ pluginMessage: { type: 'GET_BRAND_GUIDELINE' } }, '*')
  }

  /** Fetch all user's brand guidelines from server */
  async fetchList() {
    const token = window.getState('authToken')
    if (!token) return []
    try {
      const resp = await window.apiCall('/brand-guidelines', 'GET')
      return resp?.guidelines || []
    } catch (e) {
      console.warn('[BrandSync] List fetch failed:', e.message)
      return []
    }
  }

  /** Fetch a specific guideline by ID */
  async fetchById(id) {
    const token = window.getState('authToken')
    if (!token) return null
    try {
      const resp = await window.apiCall(`/brand-guidelines/${id}`, 'GET')
      return resp?.guideline || null
    } catch (e) {
      console.warn('[BrandSync] Fetch failed:', e.message)
      return null
    }
  }

  /** Create a new brand guideline */
  async create(data) {
    const token = window.getState('authToken')
    if (!token) {
      console.warn('[BrandSync] Create failed: not authenticated')
      window.eventBus?.emit('api:error', { message: 'Faça login para criar um brand guideline.' })
      return null
    }
    try {
      const resp = await window.apiCall('/brand-guidelines', 'POST', data || { identity: { name: 'Nova Marca' } })
      if (!resp?.guideline) {
        console.warn('[BrandSync] Create returned no guideline')
        return null
      }
      return resp.guideline
    } catch (e) {
      console.error('[BrandSync] Create failed:', e.message)
      window.eventBus?.emit('api:error', { message: `Erro ao criar brand guideline: ${e.message}` })
      return null
    }
  }

  /** Select a guideline as active for this Figma file */
  async select(id, options = {}) {
    const prevId = this._selectedId
    this._selectedId = id
    // Reset linked status unless explicitly set
    if (!options.fromCanvas) {
      this._isLinkedFromCanvas = false
    }

    const cached = window.getState('brandGuideline')
    const server = await this.fetchById(id)

    if (server) {
      // If we already had this one selected, check for changes
      if (prevId === id && cached && !options.force) {
        const isDifferent = this._isDifferent(cached, server)
        if (isDifferent) {
          console.log('[BrandSync] Remote change detected for', id)
          window.eventBus?.emit('brand:update-available', server)
          return cached // Keep cached for now, let user refresh
        }
      }

      // First time selecting or no changes detected
      window.setState('brandGuideline', server)
      window.setState('brandGuidelineLinkedFromCanvas', this._isLinkedFromCanvas)
      this._saveToCache(id, server)
      // Notify Canvas about selection (for reverse sync)
      this._notifyCanvasSelection(id)
      window.eventBus?.emit('brand:synchronized')
    }
    return server
  }

  /** Deep comparison helper to detect changes between cached and server data */
  _isDifferent(cached, server) {
    if (!cached || !server) return true
    
    // Quick check by updatedAt if available
    if (cached.updatedAt && server.updatedAt && cached.updatedAt !== server.updatedAt) {
      return true
    }

    // Fallback to structural comparison (simplified)
    try {
      const c = JSON.stringify(cached)
      const s = JSON.stringify(server)
      return c !== s
    } catch (e) {
      return true
    }
  }

  /** Select a guideline with auto-load from Canvas (sets "Synced with Canvas" indicator) */
  async selectWithAutoLoad(id) {
    this._isLinkedFromCanvas = true
    window.setState('brandGuidelineLinkedFromCanvas', true)
    return this.select(id, { fromCanvas: true })
  }

  /** Check if current guideline is linked from Canvas */
  isLinkedFromCanvas() {
    return this._isLinkedFromCanvas
  }

  /** Notify Canvas that a guideline was selected in the plugin */
  _notifyCanvasSelection(guidelineId) {
    parent.postMessage({
      pluginMessage: {
        type: 'GUIDELINE_SELECTED',
        guidelineId,
      }
    }, '*')
  }

  /** Save current brandGuideline state to server (debounced) */
  scheduleSave() {
    clearTimeout(this._syncTimer)
    this._syncTimer = setTimeout(() => this._saveToServer(), 1500)
  }

  async _saveToServer() {
    const token = window.getState('authToken')
    const bg = window.getState('brandGuideline')
    if (!token || !bg || !bg._id) return
    try {
      await window.apiCall(`/brand-guidelines/${bg._id}`, 'PUT', bg)
    } catch (e) {
      console.error('[BrandSync] Save failed:', e.message)
    }
  }

  /** Ingest a source into the active guideline */
  async ingest(source, options = {}) {
    const token = window.getState('authToken')
    if (!token) {
      window.eventBus?.emit('api:error', { message: 'Faça login para usar ingest.' })
      return null
    }
    const bg = window.getState('brandGuideline')
    if (!bg?._id) {
      window.eventBus?.emit('api:error', { message: 'Selecione ou crie um brand guideline primeiro.' })
      return null
    }
    try {
      const resp = await window.apiCall(`/brand-guidelines/${bg._id}/ingest`, 'POST', { source, ...options })
      if (resp?.guideline) {
        window.setState('brandGuideline', resp.guideline)
        this._saveToCache(bg._id, resp.guideline)
      }
      return resp
    } catch (e) {
      console.error('[BrandSync] Ingest failed:', e.message)
      window.eventBus?.emit('api:error', { message: `Erro ao processar: ${e.message}` })
      return null
    }
  }

  /** Delete a guideline */
  async remove(id) {
    const token = window.getState('authToken')
    if (!token) {
      console.warn('[BrandSync] Delete failed: not authenticated')
      window.eventBus?.emit('api:error', { message: 'Faça login para deletar.' })
      return
    }
    try {
      await window.apiCall(`/brand-guidelines/${id}`, 'DELETE')
      if (this._selectedId === id) {
        this._selectedId = null
        window.setState('brandGuideline', null)
        this._saveToCache(null, null)
      }
    } catch (e) {
      console.error('[BrandSync] Delete failed:', e.message)
      window.eventBus?.emit('api:error', { message: `Erro ao deletar: ${e.message}` })
    }
  }

  /** Cache in Figma pluginData */
  _saveToCache(selectedId, guideline) {
    parent.postMessage({
      pluginMessage: {
        type: 'SAVE_BRAND_GUIDELINE',
        selectedId,
        guideline: guideline ? JSON.stringify(guideline) : null,
      }
    }, '*')
  }

  /** Handle messages from Figma sandbox */
  handleMessage(msg) {
    if (msg.type === 'BRAND_GUIDELINE_LOADED') {
      if (msg.selectedId) this._selectedId = msg.selectedId
      if (msg.selectedId) {
        // Check if this is an auto-load from Canvas
        const isAutoLoad = msg.autoLoad === true

        // Use cache immediately for instant display (no loading flash)
        if (msg.guideline) {
          const parsed = typeof msg.guideline === 'string' ? JSON.parse(msg.guideline) : msg.guideline
          window.setState('brandGuideline', parsed)
        }

        // Always fetch fresh version from server in background
        // This ensures brand data is up-to-date even if edited in the web app
        if (isAutoLoad) {
          // Auto-load from Canvas - set linked indicator
          this.selectWithAutoLoad(msg.selectedId)
        } else {
          this.select(msg.selectedId)
        }
      }
    }
  }
}

window.brandSyncModule = new BrandSyncModule()
