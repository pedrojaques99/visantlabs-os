import { http, HttpResponse } from 'msw';

/**
 * MSW handlers for AI providers.
 *
 * Per-test overrides: use `server.use(...)` inside a test to replace these.
 * See tests/mocks/server.ts for the shared MSW server.
 */
export const aiHandlers = [
  // Gemini generateContent
  http.post('https://generativelanguage.googleapis.com/v1beta/models/:model\\:generateContent', async ({ request }) => {
    const body: any = await request.json().catch(() => ({}));
    const isImageRequest = request.url.includes('image') || body?.generationConfig?.responseModalities?.includes('IMAGE');
    
    if (isImageRequest) {
      return HttpResponse.json({
        candidates: [
          {
            content: {
              parts: [
                { inlineData: { data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', mimeType: 'image/png' } }
              ],
              role: 'model'
            },
            finishReason: 'STOP',
            index: 0,
          },
        ],
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 100, totalTokenCount: 150 },
      });
    }

    return HttpResponse.json({
      candidates: [
        {
          content: { parts: [{ text: 'mocked-gemini-response' }], role: 'model' },
          finishReason: 'STOP',
          index: 0,
        },
      ],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    });
  }),

  // OpenAI chat completions
  http.post('https://api.openai.com/v1/chat/completions', () =>
    HttpResponse.json({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      choices: [{ index: 0, message: { role: 'assistant', content: 'mocked-openai-response' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    })
  ),

  // Anthropic messages
  http.post('https://api.anthropic.com/v1/messages', () =>
    HttpResponse.json({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'mocked-anthropic-response' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
  ),
];

/**
 * Convenience helpers for common failure scenarios.
 */
export const aiScenarios = {
  geminiQuotaExceeded: http.post('https://generativelanguage.googleapis.com/v1beta/models/:model\\:generateContent', () =>
    HttpResponse.json({ error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } }, { status: 429 })
  ),
  geminiServerError: http.post('https://generativelanguage.googleapis.com/v1beta/models/:model\\:generateContent', () =>
    HttpResponse.json({ error: { code: 500, message: 'Internal error' } }, { status: 500 })
  ),
  openaiRateLimit: http.post('https://api.openai.com/v1/chat/completions', () =>
    HttpResponse.json({ error: { message: 'Rate limit' } }, { status: 429 })
  ),
};
