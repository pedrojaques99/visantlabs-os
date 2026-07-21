/**
 * Naming Machine — pré-filtro de disponibilidade de domínio via RDAP.
 *
 * RDAP é o protocolo oficial que substituiu o WHOIS: JSON estruturado, gratuito,
 * sem API key, com o mapa de servidores publicado pela IANA. Cobre .com (Verisign)
 * e .com.br (Registro.br), que é o par que interessa aqui.
 *
 * Heurística: checar os DOIS TLDs juntos é o que separa "domínio parkeado por um
 * revendedor" de "tem uma empresa de verdade com esse nome", sem precisar de API
 * paga de busca ou de base de marcas.
 *
 *   .com E .com.br registrados → `taken`   (descartado do deck)
 *   exatamente um registrado   → `partial` (mostrado com selo)
 *   nenhum registrado          → `free`
 *   erro/timeout               → `unknown` (mostrado, NUNCA descartado)
 *
 * Regra dura: falha de infraestrutura não pode eliminar nome. Um RDAP fora do ar
 * degradaria o deck inteiro para vazio se `unknown` contasse como ocupado.
 */

import pLimit from 'p-limit';
import { redisClient } from '../redis.js';

export type AvailabilityStatus = 'free' | 'partial' | 'taken' | 'unknown';

export interface NameAvailability {
  /** Slug consultado (nome normalizado, sem acento nem separador). */
  slug: string;
  status: AvailabilityStatus;
  /** Domínios que estão registrados — alimenta o tooltip do selo. */
  registered: string[];
}

/** TLDs consultados por nome. */
const TLDS = ['com', 'com.br'] as const;

const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';

/** Timeout por request RDAP. Curto de propósito: isso roda no caminho da geração. */
const REQUEST_TIMEOUT_MS = 4000;
/** Teto do lote inteiro. Estourou, o que faltou vira `unknown`. */
const BATCH_TIMEOUT_MS = 18000;
/**
 * Registries têm rate limit. Medido: uma leva de ~24 nomes (48 consultas) a 6
 * de concorrência fazia o registro.br devolver 429 esporádico, o resultado
 * virava `unknown` e a empresa real PASSAVA pelo filtro. Menos paralelismo +
 * um retry curto converte quase todo 429 em resposta de verdade.
 */
const CONCURRENCY = 4;
const RETRY_DELAY_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TTL_REGISTERED_S = 60 * 60 * 24 * 30; // domínio registrado raramente é liberado
const TTL_FREE_S = 60 * 60 * 24 * 3; // domínio livre pode ser comprado a qualquer hora
const TTL_BOOTSTRAP_S = 60 * 60 * 24 * 7;

/* ── Slugify ─────────────────────────────────────────────────────────────── */

/**
 * "Café Montriz" → "cafemontriz". Acento vira letra base porque domínio com
 * acento (IDN) não é o que um comprador digita.
 */
export function slugifyName(name: string): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marcas de acento após NFD
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/* ── Bootstrap IANA ──────────────────────────────────────────────────────── */

let bootstrapMemo: Map<string, string> | null = null;
let bootstrapInflight: Promise<Map<string, string>> | null = null;

function parseBootstrap(json: any): Map<string, string> {
  const map = new Map<string, string>();
  for (const [tlds, urls] of json?.services ?? []) {
    const base = (urls as string[])?.find((u) => u.startsWith('https://'));
    if (!base) continue;
    for (const tld of tlds as string[]) {
      map.set(String(tld).toLowerCase(), base.endsWith('/') ? base : `${base}/`);
    }
  }
  return map;
}

async function getBootstrap(): Promise<Map<string, string>> {
  if (bootstrapMemo) return bootstrapMemo;
  if (bootstrapInflight) return bootstrapInflight;

  bootstrapInflight = (async () => {
    try {
      const cached = await redisClient.get('naming:rdap:bootstrap');
      if (cached) {
        bootstrapMemo = parseBootstrap(JSON.parse(cached));
        return bootstrapMemo;
      }
    } catch {
      /* Redis é cache, não dependência — segue para a rede */
    }

    const res = await fetch(RDAP_BOOTSTRAP_URL, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`RDAP bootstrap HTTP ${res.status}`);
    const json = await res.json();

    try {
      await redisClient.setex('naming:rdap:bootstrap', TTL_BOOTSTRAP_S, JSON.stringify(json));
    } catch {
      /* idem */
    }

    bootstrapMemo = parseBootstrap(json);
    return bootstrapMemo;
  })().finally(() => {
    bootstrapInflight = null;
  });

  return bootstrapInflight;
}

/**
 * Resolve o servidor RDAP de um domínio. `com.br` não está no bootstrap como
 * chave própria — o registro é por TLD raiz (`br`), então encurta da esquerda
 * até achar (mesma lógica de sufixo público que o RDAP espera).
 */
async function rdapBaseFor(domain: string): Promise<string | null> {
  const map = await getBootstrap();
  const parts = domain.split('.');
  for (let i = 1; i < parts.length; i++) {
    const base = map.get(parts.slice(i).join('.'));
    if (base) return base;
  }
  return null;
}

/* ── Consulta de um domínio ──────────────────────────────────────────────── */

/** `true` = registrado, `false` = livre, `null` = não deu para saber. */
async function isRegistered(domain: string): Promise<boolean | null> {
  const cacheKey = `naming:rdap:${domain}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached === '1') return true;
    if (cached === '0') return false;
  } catch {
    /* cache indisponível — consulta direto */
  }

  const base = await rdapBaseFor(domain);
  if (!base) return null;

  // Uma tentativa extra: 429/5xx/timeout viram `unknown`, e `unknown` PASSA no
  // filtro — ou seja, throttling silenciosamente deixa empresa real entrar no
  // deck. Vale insistir uma vez antes de desistir.
  let result: boolean | null = null;
  for (let attempt = 0; attempt < 2 && result === null; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);
    try {
      const res = await fetch(`${base}domain/${domain}`, {
        headers: { Accept: 'application/rdap+json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.status === 404) result = false;
      else if (res.ok) result = true;
      // 429/5xx continuam `null`: rate limit não é sinal de ocupação.
    } catch {
      result = null;
    }
  }

  if (result !== null) {
    try {
      await redisClient.setex(cacheKey, result ? TTL_REGISTERED_S : TTL_FREE_S, result ? '1' : '0');
    } catch {
      /* idem */
    }
  }
  return result;
}

/* ── API pública ─────────────────────────────────────────────────────────── */

function classify(flags: (boolean | null)[]): AvailabilityStatus {
  if (flags.some((f) => f === null)) return 'unknown';
  const taken = flags.filter(Boolean).length;
  if (taken === flags.length) return 'taken';
  if (taken > 0) return 'partial';
  return 'free';
}

/**
 * Checa uma leva de nomes. Nunca lança: qualquer falha vira `unknown`, e
 * `unknown` nunca é descartado a jusante.
 */
export async function checkNames(names: string[]): Promise<Map<string, NameAvailability>> {
  const out = new Map<string, NameAvailability>();
  const unique = [...new Set(names.map((n) => slugifyName(n)).filter(Boolean))];
  if (!unique.length) return out;

  const limit = pLimit(CONCURRENCY);

  const work = Promise.all(
    unique.map((slug) =>
      limit(async () => {
        const domains = TLDS.map((tld) => `${slug}.${tld}`);
        const flags = await Promise.all(domains.map(isRegistered));
        out.set(slug, {
          slug,
          status: classify(flags),
          registered: domains.filter((_, i) => flags[i] === true),
        });
      })
    )
  );

  // Teto global: o que não terminou a tempo simplesmente não entra no mapa, e
  // quem consulta trata ausência como `unknown`. Melhor um deck sem selo do que
  // um usuário esperando 30s por uma checagem opcional.
  await Promise.race([
    work,
    new Promise((resolve) => setTimeout(resolve, BATCH_TIMEOUT_MS)),
  ]).catch(() => undefined);

  return out;
}

/** Status de um nome, tolerante a ausência no mapa (timeout do lote). */
export function statusOf(
  map: Map<string, NameAvailability>,
  name: string
): NameAvailability {
  const slug = slugifyName(name);
  return map.get(slug) || { slug, status: 'unknown', registered: [] };
}
