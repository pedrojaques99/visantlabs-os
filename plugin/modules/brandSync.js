// plugin/modules/brandSync.js
class BrandSyncModule {
  constructor() {
    this._syncTimer = null
    this._fileId = null
    this._fileKey = null // Figma file key for matching
    this._selectedId = null // active guideline ID for this Figma file
    this._isLinkedFromCanvas = false // true when auto-loaded from Canvas
    this._isSyncingFromFigma = false
    this._extractResolve = null // Promise resolve for extraction
  }

  init(fileId) {
    this._fileId = fileId || 'default'
    // Extract file key from fileId (format may vary)
    this._fileKey = this._extractFileKey(fileId)
    // Load selected guideline ID from Figma file cache
    parent.postMessage({ pluginMessage: { type: 'GET_BRAND_GUIDELINE' } }, '*')
    // Check for auto-sync after a short delay
    setTimeout(() => this._checkAutoSync(), 500)
  }

  /** Extract file key from various formats */
  _extractFileKey(fileId) {
    if (!fileId) return null
    // If it's already a simple key, return it
    if (/^[a-zA-Z0-9]+$/.test(fileId)) return fileId
    // Try to extract from URL-like format
    const match = fileId.match(/(?:file|design)\/([a-zA-Z0-9]+)/)
    return match?.[1] || fileId
  }

  /** Check if current file matches a linked guideline and auto-sync */
  async _checkAutoSync() {
    if (!this._fileKey) return
    const token = window.getState('authToken')
    if (!token) return

    try {
      const guidelines = await this.fetchList()
      const matched = guidelines.find(g => g.figmaFileKey === this._fileKey)
      if (matched) {
        console.log('[BrandSync] Auto-sync: File matches guideline', matched._id || matched.id)
        this._selectedId = matched._id || matched.id
        window.setState('brandGuideline', matched)
        window.setState('figmaFileLinked', true)
        // Trigger sync from Figma
        this.syncFromFigma()
      }
    } catch (e) {
      console.warn('[BrandSync] Auto-sync check failed:', e.message)
    }
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

  // ═══ FIGMA SYNC ═══

  /** Extract tokens from Figma WITHOUT sending to server (preview only) */
  async previewSync() {
    if (this._isSyncingFromFigma) {
      console.log('[BrandSync] Preview blocked: sync already in progress')
      return null
    }
    console.log('[BrandSync] Preview: requesting extraction...')
    try {
      const extractedData = await this._requestExtractionIsolated()
      if (!extractedData) return null

      // Build a human-readable summary of what will be synced
      const preview = {
        raw: extractedData,
        colors: [],
        typography: [],
        spacing: {},
        radius: {},
        shadows: {},
        components: [],
      }

      if (extractedData.variables?.colors) {
        for (const v of extractedData.variables.colors) {
          preview.colors.push({ hex: v.value, name: v.name, source: 'variable', figmaId: v.id })
        }
      }
      if (extractedData.styles?.colors) {
        for (const s of extractedData.styles.colors) {
          preview.colors.push({ hex: s.value, name: s.name, source: 'style', figmaId: s.id })
        }
      }
      if (extractedData.variables?.numbers) {
        for (const v of extractedData.variables.numbers) {
          const nl = v.name.toLowerCase()
          if (nl.includes('spacing') || nl.includes('gap') || nl.includes('padding') || nl.includes('margin')) {
            preview.spacing[v.name] = v.value
          } else if (nl.includes('radius') || nl.includes('corner') || nl.includes('round')) {
            preview.radius[v.name] = v.value
          }
        }
      }
      if (extractedData.styles?.text) {
        for (const s of extractedData.styles.text) {
          preview.typography.push({ family: s.family, style: s.style, role: s.name, size: s.size, figmaId: s.id })
        }
      }
      if (extractedData.styles?.effects) {
        for (const s of extractedData.styles.effects) {
          if (s.shadows) preview.shadows[s.name] = s.shadows
        }
      }
      if (extractedData.components) {
        preview.components = extractedData.components.map(c => ({ name: c.name, key: c.key }))
      }

      console.log('[BrandSync] Preview ready:', preview.colors.length, 'colors,', preview.typography.length, 'typography,', Object.keys(preview.spacing).length, 'spacing')
      return preview
    } catch (e) {
      console.error('[BrandSync] Preview extraction failed:', e.message)
      return null
    }
  }

  /** Send previously extracted data to a specific guideline (with optional auto-link) */
  async syncToGuideline(guidelineId, extractedData) {
    const token = window.getState('authToken')
    if (!token) return null

    try {
      const resp = await window.apiCall(`/brand-guidelines/${guidelineId}/figma-sync`, 'POST', extractedData)
      if (resp?.guideline) {
        // If this is the currently selected guideline, update state
        if (this._selectedId === guidelineId) {
          window.setState('brandGuideline', resp.guideline)
          this._saveToCache(guidelineId, resp.guideline)
        }
        window.eventBus?.emit('figma:sync-complete', { syncedAt: resp.syncedAt, stats: resp.stats })
      }
      return resp
    } catch (e) {
      console.error('[BrandSync] Sync to guideline failed:', e.message)
      window.eventBus?.emit('api:error', { message: `Sync failed: ${e.message}` })
      return null
    }
  }

  /** Link a Figma file URL to a guideline */
  async linkFigmaFile(guidelineId, figmaFileUrl) {
    const token = window.getState('authToken')
    if (!token) {
      window.eventBus?.emit('api:error', { message: 'Faça login para linkar arquivo Figma.' })
      return null
    }
    try {
      const resp = await window.apiCall(`/brand-guidelines/${guidelineId}/figma-link`, 'PUT', { figmaFileUrl })
      if (resp?.guideline) {
        window.setState('brandGuideline', resp.guideline)
        window.setState('figmaFileLinked', true)
        this._saveToCache(guidelineId, resp.guideline)
        window.eventBus?.emit('figma:linked', { figmaFileUrl: resp.figmaFileUrl })
      }
      return resp
    } catch (e) {
      console.error('[BrandSync] Link Figma failed:', e.message)
      window.eventBus?.emit('api:error', { message: `Erro ao linkar Figma: ${e.message}` })
      return null
    }
  }

  /** Unlink Figma file from guideline */
  async unlinkFigmaFile(guidelineId) {
    const token = window.getState('authToken')
    if (!token) {
      window.eventBus?.emit('api:error', { message: 'Faça login para desvincular.' })
      return null
    }
    try {
      const resp = await window.apiCall(`/brand-guidelines/${guidelineId}/figma-link`, 'DELETE')
      if (resp?.guideline) {
        window.setState('brandGuideline', resp.guideline)
        window.setState('figmaFileLinked', false)
        this._saveToCache(guidelineId, resp.guideline)
        window.eventBus?.emit('figma:unlinked')
      }
      return resp
    } catch (e) {
      console.error('[BrandSync] Unlink Figma failed:', e.message)
      window.eventBus?.emit('api:error', { message: `Erro ao desvincular: ${e.message}` })
      return null
    }
  }

  /** Sync data FROM Figma TO server */
  async syncFromFigma() {
    const token = window.getState('authToken')
    if (!token) {
      window.eventBus?.emit('api:error', { message: 'Faça login para sincronizar.' })
      return null
    }
    const bg = window.getState('brandGuideline')
    if (!bg?._id && !bg?.id) {
      window.eventBus?.emit('api:error', { message: 'Selecione um brand guideline primeiro.' })
      return null
    }

    if (this._isSyncingFromFigma) {
      console.log('[BrandSync] Sync already in progress')
      return null
    }

    this._isSyncingFromFigma = true
    window.eventBus?.emit('figma:sync-start')

    try {
      // Request extraction from Figma sandbox
      const extractedData = await this._requestExtraction()
      if (!extractedData) {
        throw new Error('Failed to extract data from Figma')
      }

      // Send to server
      const guidelineId = bg._id || bg.id
      const resp = await window.apiCall(`/brand-guidelines/${guidelineId}/figma-sync`, 'POST', extractedData)

      if (resp?.guideline) {
        window.setState('brandGuideline', resp.guideline)
        this._saveToCache(guidelineId, resp.guideline)
        window.eventBus?.emit('figma:sync-complete', {
          syncedAt: resp.syncedAt,
          stats: resp.stats
        })
      }

      return resp
    } catch (e) {
      console.error('[BrandSync] Sync from Figma failed:', e.message)
      window.eventBus?.emit('api:error', { message: `Erro ao sincronizar: ${e.message}` })
      window.eventBus?.emit('figma:sync-error', { error: e.message })
      return null
    } finally {
      this._isSyncingFromFigma = false
    }
  }

  /** Request data extraction from Figma sandbox */
  _requestExtraction() {
    return new Promise((resolve, reject) => {
      this._extractResolve = resolve
      // Set timeout for extraction
      const timeout = setTimeout(() => {
        this._extractResolve = null
        reject(new Error('Extraction timeout'))
      }, 30000)

      // Store timeout to clear on success
      this._extractTimeout = timeout

      parent.postMessage({ pluginMessage: { type: 'EXTRACT_FOR_SYNC' } }, '*')
    })
  }

  /** Isolated extraction that won't conflict with syncFromFigma's promise */
  _requestExtractionIsolated() {
    return new Promise((resolve, reject) => {
      this._previewResolve = resolve
      const timeout = setTimeout(() => {
        this._previewResolve = null
        reject(new Error('Extraction timeout'))
      }, 30000)
      this._previewTimeout = timeout
      parent.postMessage({ pluginMessage: { type: 'EXTRACT_FOR_SYNC' } }, '*')
    })
  }

  /** Push guideline data TO Figma Variables */
  async pushToFigma() {
    const bg = window.getState('brandGuideline')
    if (!bg) {
      window.eventBus?.emit('api:error', { message: 'Selecione um brand guideline primeiro.' })
      return null
    }

    window.eventBus?.emit('figma:push-start')

    return new Promise((resolve, reject) => {
      this._pushResolve = resolve
      const timeout = setTimeout(() => {
        this._pushResolve = null
        reject(new Error('Push timeout'))
      }, 30000)
      this._pushTimeout = timeout

      parent.postMessage({ pluginMessage: { type: 'PUSH_TO_FIGMA', guideline: bg } }, '*')
    })
  }

  /** Smart scan: analyze multi-selection and classify each node */
  smartScan() {
    return new Promise((resolve, reject) => {
      this._smartScanResolve = resolve
      const timeout = setTimeout(() => {
        this._smartScanResolve = null
        reject(new Error('Smart scan timeout'))
      }, 15000)
      this._smartScanTimeout = timeout
      parent.postMessage({ pluginMessage: { type: 'SMART_SCAN_SELECTION' } }, '*')
    })
  }

  /** Export a Figma node as SVG or PNG base64 data URL */
  exportNodeImage(nodeId, format = 'SVG') {
    return new Promise((resolve, reject) => {
      const key = `_exportResolve_${nodeId}`
      this[key] = resolve
      const timeout = setTimeout(() => {
        delete this[key]
        reject(new Error('Export timeout'))
      }, 15000)
      this[`_exportTimeout_${nodeId}`] = timeout
      parent.postMessage({ pluginMessage: { type: 'EXPORT_NODE_IMAGE', nodeId, format } }, '*')
    })
  }

  /** Get current file key */
  getFileKey() {
    return this._fileKey
  }

  /** Check if current file is linked to a guideline */
  isFileLinked() {
    const bg = window.getState('brandGuideline')
    return bg?.figmaFileKey === this._fileKey
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

    // Handle extraction result — resolve whichever promise is waiting (sync or preview)
    if (msg.type === 'EXTRACT_FOR_SYNC_RESULT') {
      console.log('[BrandSync] Extraction result received. Preview pending:', !!this._previewResolve, 'Sync pending:', !!this._extractResolve)
      if (this._previewResolve) {
        clearTimeout(this._previewTimeout)
        this._previewResolve(msg.data)
        this._previewResolve = null
      } else if (this._extractResolve) {
        clearTimeout(this._extractTimeout)
        this._extractResolve(msg.data)
        this._extractResolve = null
      }
    }

    if (msg.type === 'EXTRACT_FOR_SYNC_ERROR') {
      if (this._previewResolve) {
        clearTimeout(this._previewTimeout)
        this._previewResolve(null)
        this._previewResolve = null
      } else if (this._extractResolve) {
        clearTimeout(this._extractTimeout)
        this._extractResolve(null)
        this._extractResolve = null
      }
      console.error('[BrandSync] Extraction error:', msg.error)
    }

    // Handle push result
    if (msg.type === 'PUSH_TO_FIGMA_RESULT') {
      if (this._pushResolve) {
        clearTimeout(this._pushTimeout)
        this._pushResolve({ created: msg.created, updated: msg.updated })
        this._pushResolve = null
        window.eventBus?.emit('figma:push-complete', { created: msg.created, updated: msg.updated })
      }
    }

    if (msg.type === 'PUSH_TO_FIGMA_ERROR') {
      if (this._pushResolve) {
        clearTimeout(this._pushTimeout)
        this._pushResolve(null)
        this._pushResolve = null
        console.error('[BrandSync] Push error:', msg.error)
        window.eventBus?.emit('figma:push-error', { error: msg.error })
      }
    }

    // Handle smart scan result
    if (msg.type === 'SMART_SCAN_RESULT') {
      if (this._smartScanResolve) {
        clearTimeout(this._smartScanTimeout)
        this._smartScanResolve(msg.items || [])
        this._smartScanResolve = null
      }
    }

    // Handle node image export result
    if (msg.type === 'EXPORT_NODE_IMAGE_RESULT') {
      const key = `_exportResolve_${msg.nodeId}`
      const timeoutKey = `_exportTimeout_${msg.nodeId}`
      if (this[key]) {
        clearTimeout(this[timeoutKey])
        if (msg.error) {
          console.error('[BrandSync] Export error:', msg.error)
          this[key](null)
        } else {
          this[key]({ data: msg.data, format: msg.format })
        }
        delete this[key]
        delete this[timeoutKey]
      }
    }
  }
}

window.brandSyncModule = new BrandSyncModule()
