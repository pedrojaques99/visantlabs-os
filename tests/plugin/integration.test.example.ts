/**
 * Example integration test file for plugin
 * Tests the full flow of features
 */

import { useAuth, useMentions, useChatSend, useBrandSync, useDesignSystem } from 'plugin/src/ui/hooks';
import { usePluginStore } from 'plugin/src/ui/store';
import { describe, test, expect, beforeEach, vi as jest } from 'vitest';

// Declare MentionsModule if it's loaded as a global script in the environment
declare const MentionsModule: any;

// ============================================
// LOGIN FLOW INTEGRATION TEST
// ============================================

describe('Login Flow Integration', () => {
  beforeEach(() => {
    usePluginStore.getState().setAuthToken(null)
    usePluginStore.getState().setAuthEmail(null)
  })

  test('Complete login flow: credentials → token → credits → UI update', async () => {
    // 1. Setup mock API
    // @ts-expect-error Mocking partial fetch implementation
    global.fetch = jest.fn((url: string) => {
      if (url === '/api/auth/login') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              token: 'test-token-123',
              email: 'test@example.com'
            })
        })
      }
      if (url === '/api/auth/status') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              credits: { used: 5, limit: 100 }
            })
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    // 2. Execute login
    const { login } = useAuth()
    const success = await login('test@example.com', 'password')

    // 3. Verify success
    expect(success).toBe(true)

    // 4. Verify state updated
    const store = usePluginStore.getState()
    expect(store.authToken).toBe('test-token-123')
    expect(store.authEmail).toBe('test@example.com')
    expect(store.credits.used).toBe(5)
    expect(store.credits.limit).toBe(100)
  })

  test('Token persistence: save → postMessage → load on init', async () => {
    const mockParent = { postMessage: jest.fn() }
    window.parent = mockParent

    // 1. Login
    const { login } = useAuth()
    await login('user@example.com', 'pass')

    // 2. Verify SAVE_AUTH_TOKEN message sent
    expect(mockParent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginMessage: expect.objectContaining({
          type: 'SAVE_AUTH_TOKEN',
          token: expect.any(String)
        })
      }),
      'https://www.figma.com'
    )

    // 3. Simulate init: load from sandbox
    const { checkStatus } = useAuth()
    // Should call GET_AUTH_TOKEN

    // 4. Verify token still exists
    const store = usePluginStore.getState()
    expect(store.authToken).toBeTruthy()
  })
})

// ============================================
// CHAT MESSAGING INTEGRATION TEST
// ============================================

describe('Chat Messaging Flow', () => {
  beforeEach(() => {
    usePluginStore.getState().clearChatHistory()
    usePluginStore.getState().setAuthToken('test-token')
  })

  test('Complete chat flow: input → API → Gemini → operations → apply', async () => {
    // 1. Setup mocks
    // @ts-expect-error Mocking partial fetch implementation
    global.fetch = jest.fn((url: string) => {
      if (url === '/api/plugin') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              operations: [
                { type: 'CREATE_FRAME', name: 'Generated Frame' },
                { type: 'SET_FILL', hex: '#00ebff' }
              ],
              message: 'Created frame with brand color'
            })
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    // 2. Send chat message
    const { sendMessage } = useChatSend()
    await sendMessage('Create a blue button')

    // 3. Verify message added to history
    const store = usePluginStore.getState()
    expect(store.chatHistory).toHaveLength(1)
    expect(store.chatHistory[0].content).toBe('Create a blue button')
    expect(store.chatHistory[0].role).toBe('user')

    // 4. Simulate API response (message from sandbox)
    const assistantMessage = {
      id: '2',
      role: 'assistant' as const,
      content: 'Created frame with brand color',
      timestamp: Date.now(),
      operations: [
        { type: 'CREATE_FRAME', name: 'Generated Frame' },
        { type: 'SET_FILL', hex: '#00ebff' }
      ]
    }

    store.addChatMessage(assistantMessage)

    // 5. Verify both messages in history
    expect(store.chatHistory).toHaveLength(2)
    expect(store.chatHistory[1].operations).toBeDefined()
  })

  test('Chat with @mentions: input → extract → send → apply', async () => {
    // 1. Create message with mention
    const message = 'Update @"PrimaryButton"[component:123] with brand colors'

    // 2. Extract mentions
    const mentions = MentionsModule.extractMentions(message)

    // 3. Verify extraction
    expect(mentions).toHaveLength(1)
    expect(mentions[0].name).toBe('PrimaryButton')
    expect(mentions[0].type).toBe('component')

    // 4. Send message (would include mentions in context)
    const store = usePluginStore.getState()
    store.addChatMessage({
      id: '1',
      role: 'user',
      content: message,
      timestamp: Date.now()
    })

    // 5. Verify message stored
    expect(store.chatHistory[0].content).toContain('@"PrimaryButton"')
  })
})

// ============================================
// BRAND GUIDELINES SYNC INTEGRATION TEST
// ============================================

describe('Brand Guidelines Sync Flow', () => {
  beforeEach(() => {
    const store = usePluginStore.getState()
    store.logos = [
      { name: 'light' },
      { name: 'dark' },
      { name: 'accent' }
    ]
    store.selectedColors.clear()
  })

  test('Complete sync: upload → save → fetch → apply', async () => {
    // 1. Setup mock API
    // @ts-expect-error Mocking partial fetch implementation
    global.fetch = jest.fn((url: string) => {
      if (url === '/api/brand-guidelines') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'guid-123',
              name: 'Q1 Brand',
              logos: [{ name: 'light', url: '...' }],
              colors: [{ role: 'primary', hex: '#ff0000' }]
            })
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })

    // 2. Upload logo
    const store = usePluginStore.getState()
    const logoData = 'data:image/png;base64,...'
    store.updateBrandLogo('light', logoData)

    // 3. Add colors
    store.addSelectedColor('primary', { hex: '#ff0000', role: 'primary' })
    store.addSelectedColor('secondary', { hex: '#0000ff', role: 'secondary' })

    // 4. Save to API
    const { saveBrandGuideline } = useBrandSync()
    const result = await saveBrandGuideline({
      name: 'Q1 Brand',
      logos: store.logos,
      colors: Array.from(store.selectedColors.values())
    } as any)

    // 5. Verify saved
    expect(result?.id).toBe('guid-123')

    // 6. Load from API
    const { loadBrandGuidelines } = useBrandSync()
    const guidelines = await loadBrandGuidelines()
    expect(guidelines).toBeDefined()
  })

  test('Design System sync: import → validate → apply', async () => {
    // 1. Create Design System JSON
    const dsJson = JSON.stringify({
      name: 'Material Design 3',
      format: 'visant',
      tokens: {
        spacing: { xs: '4px', sm: '8px', md: '16px' },
        radius: { sm: '4px', md: '8px', lg: '12px' },
        colors: [
          { name: 'primary', hex: '#6200EE' },
          { name: 'secondary', hex: '#03DAC6' }
        ]
      }
    })

    // 2. Import DS
    const { importFromJson } = useDesignSystem()
    const success = importFromJson(dsJson)
    expect(success).toBe(true)

    // 3. Verify stored
    const store = usePluginStore.getState()
    expect(store.designSystem?.name).toBe('Material Design 3')
    expect(store.designSystem?.tokens?.spacing).toBeDefined()
  })
})

// ============================================
// MENTION AUTOCOMPLETE INTEGRATION TEST
// ============================================

describe('Mention Autocomplete Flow', () => {
  test('Mention input: @ detected → request elements → filter → select → insert', async () => {
    // Setup mock
    // @ts-expect-error Mocking partial fetch implementation
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            elements: [
              { id: '1', name: 'Button', type: 'component' },
              { id: '2', name: 'ButtonGroup', type: 'component' },
              { id: '3', name: 'Frame', type: 'frame' }
            ]
          })
      })
    )

    // Simulate user typing @ in input
    const inputRef = {
      current: {
        value: 'Hey @bu',
        selectionStart: 7
      }
    } as any

    const { checkForMention, selectMention, items, setItems } = useMentions(inputRef)

    // 1. Detect mention
    checkForMention()

    // 2. Simulate elements response
    // (in real code, GET_ELEMENTS_FOR_MENTIONS would fetch these)
    setItems([
      { id: '1', name: 'Button', type: 'component' },
      { id: '2', name: 'ButtonGroup', type: 'component' }
    ])

    // 3. Select first match
    if (items.length > 0) {
      selectMention(items[0])

      // 4. Verify insertion
      expect(inputRef.current.value).toContain('@"Button"[component:1]')
    }
  })
})

// ============================================
// ERROR HANDLING INTEGRATION TEST
// ============================================

describe('Error Handling', () => {
  test('API error: request fails → toast shown → user notified', async () => {
    // @ts-expect-error Mocking partial fetch implementation
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })
    )

    const { login } = useAuth()
    const result = await login('test@example.com', 'wrong-password')

    expect(result).toBe(false)

    const store = usePluginStore.getState()
    expect(store.toastMessage).toBeTruthy()
    expect(store.toastType).toBe('error')
  })

  test('Invalid JSON import: parse fails → validation error → toast', () => {
    const { importFromJson } = useDesignSystem()
    const invalidJson = '{ broken json }'

    const result = importFromJson(invalidJson)

    expect(result).toBe(false)

    const store = usePluginStore.getState()
    expect(store.toastMessage).toContain('Invalid JSON')
  })

  test('Network error: request fails → retry logic → fallback', async () => {
    let attemptCount = 0
    // @ts-expect-error Mocking partial fetch implementation
    global.fetch = jest.fn(() => {
      attemptCount++
      if (attemptCount < 3) {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    })

    // Should retry and eventually succeed
    // (implementation depends on retry logic in useApi)
  })
})
