import { describe, it, expect } from 'vitest';
import {
  detectPendingTurn,
  isReplyToPendingQuestion,
  buildContinuationContext,
  type ConversationTurn,
} from '../prompt/continuation.js';
import { assemblePrompt } from '../prompt/index.js';
import { classifyIntent } from '../prompt/classifier.js';

// The exact dialog that regressed: user asks for a mockup, assistant asks which brand,
// user answers "Visant", assistant greets them like a stranger.
const MOCKUP_REQUEST = 'Mockup de cartão de visita';
const BRAND_QUESTION =
  'Para criar o mockup do cartão de visita, qual marca você gostaria de utilizar? As opções disponíveis são: Lola®, Urban Stay®, Soccer 248, Comunicart®, Feira 2026, Days n\' Days, Movitera, Padoo®, YSA ou Clube Influência®.';

const BUG_HISTORY: ConversationTurn[] = [
  { role: 'user', content: MOCKUP_REQUEST },
  { role: 'assistant', content: BRAND_QUESTION },
];

describe('detectPendingTurn', () => {
  it('flags the unanswered question and recovers the request it blocked on', () => {
    const pending = detectPendingTurn(BUG_HISTORY);
    expect(pending.hasPendingQuestion).toBe(true);
    expect(pending.pendingRequest).toBe(MOCKUP_REQUEST);
    expect(pending.question).toContain('qual marca');
  });

  it('finds questions buried mid-message, not just trailing "?"', () => {
    // The real message ends in a period — the "?" sits in the middle.
    expect(BRAND_QUESTION.trim().endsWith('?')).toBe(false);
    expect(detectPendingTurn(BUG_HISTORY).hasPendingQuestion).toBe(true);
  });

  it('is not pending once a user turn follows the question', () => {
    const answered = [...BUG_HISTORY, { role: 'user', content: 'Visant' }];
    expect(detectPendingTurn(answered).hasPendingQuestion).toBe(false);
  });

  it('is not pending when the assistant simply made a statement', () => {
    const history = [
      { role: 'user', content: MOCKUP_REQUEST },
      { role: 'assistant', content: 'Pronto, criei o cartão de visita.' },
    ];
    expect(detectPendingTurn(history).hasPendingQuestion).toBe(false);
  });

  it('skips chatter when walking back for the pending request', () => {
    const history: ConversationTurn[] = [
      { role: 'user', content: MOCKUP_REQUEST },
      { role: 'assistant', content: 'Certo.' },
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: BRAND_QUESTION },
    ];
    expect(detectPendingTurn(history).pendingRequest).toBe(MOCKUP_REQUEST);
  });

  it('handles empty history', () => {
    expect(detectPendingTurn([]).hasPendingQuestion).toBe(false);
  });
});

describe('isReplyToPendingQuestion', () => {
  const pending = detectPendingTurn(BUG_HISTORY);

  it('treats a bare brand name as the answer', () => {
    expect(isReplyToPendingQuestion('Visant', pending)).toBe(true);
  });

  it('does not treat a greeting as an answer', () => {
    expect(isReplyToPendingQuestion('oi', pending)).toBe(false);
  });

  it('leaves messages with their own design intent alone', () => {
    // Already classifies correctly on its own — no rescue needed.
    expect(isReplyToPendingQuestion('cria um banner 1080x1080', pending)).toBe(false);
  });

  it('is inert with no pending question', () => {
    expect(isReplyToPendingQuestion('Visant', { hasPendingQuestion: false })).toBe(false);
  });
});

describe('buildContinuationContext', () => {
  it('carries the question, the answer and the original request', () => {
    const ctx = buildContinuationContext('Visant', detectPendingTurn(BUG_HISTORY));
    expect(ctx).toContain('qual marca');
    expect(ctx).toContain('Visant');
    expect(ctx).toContain(MOCKUP_REQUEST);
    expect(ctx).toMatch(/NAO cumprimente/i);
  });
});

describe('classifyIntent — verbless artifact requests', () => {
  it('reads a named artifact as a create request', () => {
    // The dialog that started this: no verb, so nothing used to match and it fell to chat —
    // a mockup request assembled with no create rules at all.
    expect(classifyIntent(MOCKUP_REQUEST).intent).toBe('create');
    expect(classifyIntent('banner para instagram').intent).toBe('create');
    expect(classifyIntent('logo da padaria').intent).toBe('create');
  });

  it('never overrides an explicit verb', () => {
    expect(classifyIntent('deleta o mockup').intent).toBe('delete');
    expect(classifyIntent('duplica o banner').intent).toBe('clone');
    expect(classifyIntent('muda a cor do post').intent).toBe('edit');
    expect(classifyIntent('alinha os cards ao centro').intent).toBe('arrange');
  });

  it('leaves questions about artifacts as chat', () => {
    expect(classifyIntent('o que é um mockup?').intent).toBe('chat');
    expect(classifyIntent('qual o tamanho de um banner?').intent).toBe('chat');
    expect(classifyIntent('como funciona o carrossel').intent).toBe('chat');
  });

  it('leaves genuine chat as chat', () => {
    expect(classifyIntent('oi').intent).toBe('chat');
    expect(classifyIntent('obrigado, ficou ótimo').intent).toBe('chat');
  });
});

describe('assemblePrompt — the regression', () => {
  const chatHistory = BUG_HISTORY.map((m) => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n');

  it('answering "Visant" continues the mockup instead of decaying into chat', () => {
    const assembled = assemblePrompt({
      command: 'Visant',
      chatHistory,
      pendingTurn: detectPendingTurn(BUG_HISTORY),
    });

    expect(assembled.modules).toContain('continuation');
    expect(assembled.modules).toContain('history');
    expect(assembled.modules).not.toContain('chat_only');
    expect(assembled.system).toContain(MOCKUP_REQUEST);
    expect(assembled.system).toMatch(/NAO cumprimente/i);
  });

  it('the reply inherits the intent the original request was classified with', () => {
    // The contract: a reply is the pending request's turn, so it must classify as that
    // request would — never as a fresh, contextless message.
    const asReply = assemblePrompt({
      command: 'Visant',
      chatHistory,
      pendingTurn: detectPendingTurn(BUG_HISTORY),
    });
    const asOriginal = assemblePrompt({ command: MOCKUP_REQUEST });
    expect(asReply.intent.intent).toBe(asOriginal.intent.intent);
    expect(asReply.intent.format).toBe(asOriginal.intent.format);
  });

  it('reproduces the bug when pending state is absent', () => {
    // Guards the fix: without conversation state, "Visant" is still historyless chat.
    const assembled = assemblePrompt({ command: 'Visant', chatHistory });
    expect(assembled.intent.intent).toBe('chat');
    expect(assembled.modules).toContain('chat_only');
  });

  it('real chat still gets the conversation, just not design rules', () => {
    const assembled = assemblePrompt({
      command: 'oi',
      chatHistory,
      pendingTurn: detectPendingTurn(BUG_HISTORY),
    });

    expect(assembled.intent.intent).toBe('chat');
    expect(assembled.modules).toContain('chat_only');
    // The old chat-only path returned a 4-line prompt with zero history.
    expect(assembled.modules).toContain('history');
    expect(assembled.system).toContain(MOCKUP_REQUEST);
    expect(assembled.modules).not.toContain('continuation');
  });

  it('a brand choice list survives the chat-only path', () => {
    const assembled = assemblePrompt({
      command: 'oi',
      chatHistory,
      brandChoiceContext: 'MARCAS DISPONIVEIS: Visant, Lola',
      pendingTurn: detectPendingTurn(BUG_HISTORY),
    });
    expect(assembled.modules).toContain('brand_choice');
    expect(assembled.system).toContain('MARCAS DISPONIVEIS');
  });

  it('is a no-op for ordinary requests with no pending question', () => {
    const assembled = assemblePrompt({ command: 'cria um post 1080x1080 para instagram' });
    expect(assembled.modules).not.toContain('continuation');
    expect(assembled.intent.intent).toBe('create');
  });
});
