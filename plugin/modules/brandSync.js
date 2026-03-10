// plugin/modules/brandSync.js
class BrandSyncModule {
  constructor() {
    this._syncTimer = null
    this._fileId = null
    this._selectedId = null // active guideline ID for this Figma file
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
    const resp = await window.apiCall('/brand-guidelines', 'POST', data || { identity: { name: 'Nova Marca' } })
    return resp?.guideline || null
  }

  /** Select a guideline as active for this Figma file */
  async select(id) {
    this._selectedId = id
    const guideline = await this.fetchById(id)
    if (guideline) {
      window.setState('brandGuideline', guideline)
      this._saveToCache(id, guideline)
    }
    return guideline
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
    const bg = window.getState('brandGuideline')
    if (!bg?._id) throw new Error('No active brand guideline. Create or select one first.')
    const resp = await window.apiCall(`/brand-guidelines/${bg._id}/ingest`, 'POST', { source, ...options })
    if (resp?.guideline) {
      window.setState('brandGuideline', resp.guideline)
      this._saveToCache(bg._id, resp.guideline)
    }
    return resp
  }

  /** Delete a guideline */
  async remove(id) {
    await window.apiCall(`/brand-guidelines/${id}`, 'DELETE')
    if (this._selectedId === id) {
      this._selectedId = null
      window.setState('brandGuideline', null)
      this._saveToCache(null, null)
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
      if (msg.guideline && !window.getState('brandGuideline')) {
        const parsed = typeof msg.guideline === 'string' ? JSON.parse(msg.guideline) : msg.guideline
        window.setState('brandGuideline', parsed)
      }
      // If we have a selectedId but no cached data, fetch from server
      if (msg.selectedId && !msg.guideline) {
        this.select(msg.selectedId)
      }
    }
  }
}

window.brandSyncModule = new BrandSyncModule()
