import { useState, useEffect } from 'react';
import type { TextProvider } from '@/constants/geminiModels';
import { authService } from '@/services/authService';

/**
 * Saúde da cascata de texto do backend (`server/lib/ai-providers/cheapText.ts`).
 *
 * Separado de `useAvailableProviders` (que é imagem/vídeo e lê apenas presença
 * de env) porque aqui a resposta é BYOK-aware: um usuário com chave própria da
 * OpenAI tem o provider disponível mesmo sem chave de plataforma. Gatear texto
 * pelo endpoint de imagem esconderia modelos que o usuário PODE usar.
 *
 * `coolingDownMs > 0` = provider derrubado há pouco e em backoff.
 */
export interface TextProviderStatus {
  id: TextProvider;
  configured: boolean;
  coolingDownMs: number;
}

/** Fail-open: sem resposta, não escondemos nada — melhor oferecer do que sumir. */
const DEFAULT: TextProviderStatus[] = [];

/**
 * O cooldown mais curto do backend é 90s (429). Um cache eterno mostraria
 * "instável agora" para sempre — ou, pior, nunca mostraria. Revalidar em 60s
 * mantém o estado útil sem transformar o seletor em polling.
 */
const CACHE_TTL_MS = 60_000;

let cache: TextProviderStatus[] | null = null;
let cachedAt = 0;
let fetchPromise: Promise<TextProviderStatus[]> | null = null;

function isFresh(): boolean {
  return !!cache && Date.now() - cachedAt < CACHE_TTL_MS;
}

async function fetchTextProviders(): Promise<TextProviderStatus[]> {
  try {
    const token = authService.getToken();
    if (!token) return DEFAULT; // anônimo: sem BYOK para consultar
    const res = await fetch('/api/ai/text-providers', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return DEFAULT;
    const data = await res.json();
    return Array.isArray(data?.providers) ? data.providers : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function useTextProviders(): TextProviderStatus[] {
  const [providers, setProviders] = useState<TextProviderStatus[]>(() => cache || DEFAULT);

  useEffect(() => {
    let alive = true;
    if (isFresh()) {
      setProviders(cache!);
      return;
    }
    if (!fetchPromise) {
      fetchPromise = fetchTextProviders().finally(() => {
        fetchPromise = null; // libera a próxima revalidação
      });
    }
    fetchPromise.then((data) => {
      cache = data;
      cachedAt = Date.now();
      if (alive) setProviders(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return providers;
}

/** Invalida o cache — para testes e para quando o usuário troca de conta (BYOK muda). */
export function resetTextProvidersCache(): void {
  cache = null;
  cachedAt = 0;
  fetchPromise = null;
}

/**
 * Um provider de texto pode ser oferecido? Lista vazia (ainda carregando, ou
 * anônimo) = tudo liberado, para o seletor nunca aparecer vazio.
 */
export function isTextProviderAvailable(
  providers: TextProviderStatus[],
  provider: TextProvider
): boolean {
  if (!providers.length) return true;
  return providers.find((p) => p.id === provider)?.configured ?? false;
}
