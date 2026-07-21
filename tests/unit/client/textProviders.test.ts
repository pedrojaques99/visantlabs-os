import { describe, it, expect } from 'vitest';
import { isTextProviderAvailable, type TextProviderStatus } from '@/hooks/useTextProviders';

/**
 * Gate do seletor de modelo de chat. Errar aqui tem dois modos de falha opostos
 * e ambos ruins: esconder demais (o usuário não acha um modelo que PODE usar) ou
 * de menos (ele escolhe um provider sem chave e só descobre ao gerar).
 */
const status = (over: Partial<TextProviderStatus> & { id: TextProviderStatus['id'] }) => ({
  configured: true,
  coolingDownMs: 0,
  ...over,
});

describe('isTextProviderAvailable', () => {
  it('libera provider com chave', () => {
    const providers = [status({ id: 'openai' })];
    expect(isTextProviderAvailable(providers, 'openai')).toBe(true);
  });

  it('esconde provider sem chave', () => {
    const providers = [status({ id: 'openai', configured: false })];
    expect(isTextProviderAvailable(providers, 'openai')).toBe(false);
  });

  it('esconde provider que nem aparece na resposta', () => {
    const providers = [status({ id: 'gemini' })];
    expect(isTextProviderAvailable(providers, 'openai')).toBe(false);
  });

  // Fail-open: enquanto carrega (ou anônimo) o seletor não pode ficar vazio.
  it('libera tudo quando a lista está vazia (carregando/anônimo)', () => {
    expect(isTextProviderAvailable([], 'openai')).toBe(true);
    expect(isTextProviderAvailable([], 'gemini')).toBe(true);
  });

  // Cooldown é sinal de instabilidade, não de ausência de chave — o provider
  // continua selecionável (a cascata só o pula naquele instante).
  it('mantém selecionável um provider em cooldown', () => {
    const providers = [status({ id: 'gemini', coolingDownMs: 90_000 })];
    expect(isTextProviderAvailable(providers, 'gemini')).toBe(true);
  });
});
