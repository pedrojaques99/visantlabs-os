/**
 * Example test file structure for plugin unit tests
 *
 * To run:
 * npm test -- tests/plugin/unit.test.example.ts
 */

import { usePluginStore } from '../../plugin/src/ui/store';


// ============================================
// STORE TESTS
// ============================================

describe('Zustand Store', () => {
  // Test: updateSelection
  test('should update selection details', () => {
    const store = usePluginStore.getState()
    const selection = [{ id: '1', name: 'Frame', type: 'FRAME' }]
    store.updateSelection(selection)
    expect(store.selectionDetails).toEqual(selection)
  })

  // Test: addChatMessage
  test('should add chat message to history', () => {
    const store = usePluginStore.getState()
    store.clearChatHistory()
    const message = {
      id: '1',
      role: 'user' as const,
      content: 'Test message',
      timestamp: Date.now()
    }
    store.addChatMessage(message)
    expect(store.chatHistory).toHaveLength(1)
    expect(store.chatHistory[0].content).toBe('Test message')
  })

  // Test: Auth tokens
  test('should store and clear auth tokens', () => {
    const store = usePluginStore.getState()
    store.setAuthToken('test-token')
    store.setAuthEmail('test@example.com')
    expect(store.authToken).toBe('test-token')
    expect(store.authEmail).toBe('test@example.com')

    store.setAuthToken(null)
    store.setAuthEmail(null)
    expect(store.authToken).toBeNull()
    expect(store.authEmail).toBeNull()
  })

  // Test: Brand colors
  test('should add and remove brand colors', () => {
    const store = usePluginStore.getState()
    store.addSelectedColor('primary', { hex: '#ff0000', role: 'primary' })
    expect(store.selectedColors.has('primary')).toBe(true)

    store.removeSelectedColor('primary')
    expect(store.selectedColors.has('primary')).toBe(false)
  })

  // Test: Logo updates
  test('should update brand logos', () => {
    const store = usePluginStore.getState()
    const logoSrc = 'data:image/png;base64,...'
    store.updateBrandLogo('light', logoSrc)
    expect(store.logos[0].src).toBe(logoSrc)
    expect(store.logos[0].loaded).toBe(true)
  })

  // Test: Toast notifications
  test('should show toast notifications', (done) => {
    const store = usePluginStore.getState()
    store.showToast('Test message', 'success')
    expect(store.toastMessage).toBe('Test message')
    expect(store.toastType).toBe('success')

    // Auto-dismiss after 3s
    setTimeout(() => {
      expect(store.toastMessage).toBeUndefined()
      done()
    }, 3100)
  })
})

// ============================================
// HOOK TESTS
// ============================================

describe('useAuth Hook', () => {
  // Test: Login flow
  test('should login with email and password', async () => {
    const { login } = useAuth()
    // Mock API response
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ token: 'test-token' })
      })
    )

    const result = await login('test@example.com', 'password')
    expect(result).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', expect.any(Object))
  })

  // Test: Logout
  test('should logout and clear tokens', () => {
    const { logout } = useAuth()
    const store = usePluginStore.getState()
    store.setAuthToken('token')
    logout()
    expect(store.authToken).toBeNull()
  })
})

describe('useMentions Hook', () => {
  // Test: Mention detection
  test('should detect @ in input', () => {
    const inputRef = { current: { value: 'Hey @frame', selectionStart: 10 } }
    const { checkForMention } = useMentions(inputRef)
    checkForMention()
    // Should detect @frame
  })

  // Test: Mention insertion
  test('should insert mention with correct format', () => {
    const { selectMention } = useMentions(inputRef)
    selectMention({ id: '123', name: 'Button', type: 'component' })
    expect(inputRef.current.value).toContain('@"Button"[component:123]')
  })
})

// ============================================
// API TESTS
// ============================================

describe('useApi Hook', () => {
  // Test: API call with auth
  test('should include auth header in request', async () => {
    const { call } = useApi()
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ data: 'test' }) })
    )

    const store = usePluginStore.getState()
    store.setAuthToken('test-token')

    await call('/api/test')
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      })
    )
  })

  // Test: Error handling (401)
  test('should clear auth on 401 error', async () => {
    const { call } = useApi()
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 401 })
    )

    const store = usePluginStore.getState()
    store.setAuthToken('expired-token')

    try {
      await call('/api/test')
    } catch (err) {
      expect(store.authToken).toBeNull()
    }
  })
})

// ============================================
// STORE TESTS
// ============================================

describe('useBrandSync Hook', () => {
  // Test: Save guideline
  test('should save brand guideline to API', async () => {
    const { saveBrandGuideline } = useBrandSync()
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ id: '123' }) })
    )

    const guideline = { name: 'Test Brand' }
    const result = await saveBrandGuideline(guideline as any)
    expect(global.fetch).toHaveBeenCalledWith('/api/brand-guidelines', expect.any(Object))
    expect(result?.id).toBe('123')
  })

  // Test: Load guidelines list
  test('should load brand guidelines list', async () => {
    const { loadBrandGuidelines } = useBrandSync()
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: '1', name: 'Brand 1' }])
      })
    )

    const result = await loadBrandGuidelines()
    expect(Array.isArray(result)).toBe(true)
  })
})

// ============================================
// DESIGN SYSTEM TESTS
// ============================================

describe('useDesignSystem Hook', () => {
  // Test: Import Visant format
  test('should import Visant format DS', () => {
    const { importFromJson } = useDesignSystem()
    const json = JSON.stringify({
      name: 'Test DS',
      format: 'visant',
      tokens: { spacing: { xs: '4px' } }
    })

    const result = importFromJson(json)
    expect(result).toBe(true)
  })

  // Test: Import W3C format
  test('should detect and import W3C format', () => {
    const { importFromJson } = useDesignSystem()
    const json = JSON.stringify({
      $schema: 'https://tokens.studio/...',
      color: { primary: { $value: '#ff0000' } }
    })

    const result = importFromJson(json)
    expect(result).toBe(true)
  })

  // Test: Invalid JSON
  test('should reject invalid JSON', () => {
    const { importFromJson } = useDesignSystem()
    const result = importFromJson('{ invalid json }')
    expect(result).toBe(false)
  })
})

// ============================================
// MENTION EXTRACTION TESTS
// ============================================

describe('Mention extraction', () => {
  // Test: Extract mentions from text
  test('should extract mentions from message', () => {
    const text = 'Hey @"Button"[component:123] and @"Frame"[frame:456]'
    const mentions = MentionsModule.extractMentions(text)
    expect(mentions).toHaveLength(2)
    expect(mentions[0]).toEqual({
      name: 'Button',
      type: 'component',
      id: '123'
    })
  })

  // Test: No mentions
  test('should return empty array if no mentions', () => {
    const text = 'Just a regular message'
    const mentions = MentionsModule.extractMentions(text)
    expect(mentions).toHaveLength(0)
  })
})

// ============================================
// POSTMESSAGE PROTOCOL TESTS
// ============================================

describe('PostMessage protocol', () => {
  // Test: Message format
  test('should send properly formatted postMessage', () => {
    const mockParent = { postMessage: jest.fn() }
    window.parent = mockParent

    const message = { type: 'GET_CONTEXT' }
    window.parent.postMessage({ pluginMessage: message }, 'https://www.figma.com')

    expect(mockParent.postMessage).toHaveBeenCalledWith(
      { pluginMessage: message },
      'https://www.figma.com'
    )
  })

  // Test: Message handler
  test('should dispatch messages to store', () => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage
      if (msg?.type === 'CONTEXT_UPDATED') {
        // Should update store
        usePluginStore.getState().updateSelection(msg.selection)
      }
    }

    const event = new MessageEvent('message', {
      data: {
        pluginMessage: {
          type: 'CONTEXT_UPDATED',
          selection: [{ id: '1', name: 'Frame' }]
        }
      }
    })

    handler(event)
    expect(usePluginStore.getState().selectionDetails).toHaveLength(1)
  })
})
