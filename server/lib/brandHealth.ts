/**
 * Brand Health Check — opt-in LLM analysis of brand coherence.
 *
 * Triggered by user click on "Run Brand Health" inside the completeness pill.
 * Uses Gemini Flash (cheap) + buildBrandContextJSONString (already canonical).
 *
 * Returns coherence findings the quantitative score cannot see, e.g.:
 *   - "Manifesto says 'minimalist' but typography has 4 distinct families"
 *   - "Archetype is Rebel but voice tone is corporate-formal"
 *   - "Primary color contrast is below 4.5:1 on body background"
 */

import type { BrandGuideline } from '../../src/lib/figma-types.js';
import { buildBrandContextJSONString } from './brandContextBuilder.js';
import { chatWithAIContext } from '../services/geminiService.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';

export interface BrandHealthInsight {
  level: 'pass' | 'warn' | 'fail';
  category: 'identity' | 'visual' | 'strategy' | 'voice' | 'tokens' | 'coherence';
  title: string;
  detail: string;
}

export interface BrandHealthRecommendation {
  /** Short imperative — e.g. "Reduce typography to 2 families" */
  action: string;
  /** Why it matters for AI generation quality */
  reason: string;
}

export interface BrandHealthReport {
  score: number; // 0..100, LLM-judged coherence score
  summary: string; // 1-2 sentences
  insights: BrandHealthInsight[];
  recommendations: BrandHealthRecommendation[];
  model: string;
  tokens: { input?: number; output?: number };
  generatedAt: string;
}

const SYSTEM = `You are a senior brand strategist auditing a brand guideline for coherence and AI-generation readiness.

Return STRICT JSON ONLY (no prose, no markdown fences) matching this exact shape:
{
  "score": <0-100 integer>,
  "summary": "<1-2 sentences in the brand's user language>",
  "insights": [
    { "level": "pass|warn|fail", "category": "identity|visual|strategy|voice|tokens|coherence",
      "title": "<short headline>", "detail": "<one sentence>" }
  ],
  "recommendations": [
    { "action": "<imperative, short>", "reason": "<why this improves AI generation results>" }
  ]
}

Rules for the audit:
- Score reflects COHERENCE between strategy ↔ visual ↔ voice, not completeness.
- Look for contradictions (e.g. "minimalist" manifesto + 5+ font families).
- Consider AI-generation impact: ambiguous palette roles → bad image gen; missing tone → off-brand copy.
- 4-8 insights, 3-6 recommendations. Be clear, specific and human — plain language a brand owner understands, not academic jargon. No emoji, no praise filler.
- Each "detail" and "reason" must say something concrete and actionable about THIS brand; never use abstract filler like "strategic void" or "precludes calibration".
- Detect the language of the brand context (Portuguese vs English) and respond in that language for "summary"/"title"/"detail"/"action"/"reason".`;

/**
 * True when a guideline has no substantive content yet — only an identity (or
 * nothing). Running an LLM audit on this just spends a credit to say "it's
 * empty", so callers should short-circuit with buildEmptyBrandHealthReport.
 */
export function isBrandEmpty(bg: BrandGuideline): boolean {
  const g = bg as any;
  return (
    !(g.colors?.length) &&
    !(g.typography?.length) &&
    !g.guidelines?.voice &&
    !(g.guidelines?.dos?.length) &&
    !(g.guidelines?.donts?.length) &&
    !g.strategy?.manifesto &&
    !g.strategy?.coreMessage?.product &&
    !(g.strategy?.positioning?.length) &&
    !(g.logos?.length)
  );
}

/**
 * Deterministic, friendly report for an empty brand — no LLM, no credit spend.
 * Tells the owner exactly what to add and how, in their UI language.
 */
export function buildEmptyBrandHealthReport(bg: BrandGuideline): BrandHealthReport {
  const pt = /[áàâãéêíóôõúç]/i.test(((bg as any).identity?.description as string) || '');
  const name = (bg as any).identity?.name || (pt ? 'sua marca' : 'this brand');
  return {
    score: 0,
    summary: pt
      ? `${name} ainda não tem conteúdo pra auditar. Adicione cores, tipografia e tom de voz — ou use brand-guidelines-ingest com uma URL ou texto pra preencher tudo de uma vez.`
      : `${name} has no content to audit yet. Add colors, typography and a tone of voice — or use brand-guidelines-ingest with a URL or text to populate it all at once.`,
    insights: [
      {
        level: 'warn',
        category: 'identity',
        title: pt ? 'Marca vazia' : 'Empty brand',
        detail: pt
          ? 'Só o nome está preenchido. Os blocos visuais e de estratégia ainda estão em branco.'
          : 'Only the name is filled in. The visual and strategy blocks are still empty.',
      },
    ],
    recommendations: [
      {
        action: pt
          ? 'Rodar brand-guidelines-ingest (source=url ou text)'
          : 'Run brand-guidelines-ingest (source=url or text)',
        reason: pt
          ? 'Extrai cores, tipografia, tom e estratégia automaticamente a partir do site ou de um texto.'
          : 'Auto-extracts colors, typography, voice and strategy from a website or pasted text.',
      },
      {
        action: pt ? 'Adicionar a paleta de cores' : 'Add the color palette',
        reason: pt
          ? 'Cores com papéis (primary/background/text) são a base pra geração de imagem e tokens.'
          : 'Colors with roles (primary/background/text) are the base for image generation and tokens.',
      },
      {
        action: pt ? 'Definir o tom de voz' : 'Define the tone of voice',
        reason: pt
          ? 'Sem tom definido, a geração de copy sai genérica e fora da marca.'
          : 'Without a defined tone, generated copy comes out generic and off-brand.',
      },
    ],
    model: 'deterministic',
    tokens: {},
    generatedAt: new Date().toISOString(),
  };
}

export async function runBrandHealth(
  guideline: BrandGuideline,
  options: { apiKey?: string } = {}
): Promise<BrandHealthReport> {
  if (isBrandEmpty(guideline)) return buildEmptyBrandHealthReport(guideline);

  const context = buildBrandContextJSONString(guideline);

  const result = await chatWithAIContext(
    'Audit this brand guideline. Return strict JSON only.',
    context,
    [],
    {
      apiKey: options.apiKey,
      model: GEMINI_MODELS.TEXT,
      systemInstruction: SYSTEM,
    }
  );

  const raw: string = (result.text || '').trim();
  const parsed = parseJsonReport(raw);

  return {
    score: clampInt(parsed.score, 0, 100),
    summary: String(parsed.summary || '').slice(0, 400),
    insights: Array.isArray(parsed.insights)
      ? parsed.insights.slice(0, 12).map(normalizeInsight)
      : [],
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.slice(0, 8).map(normalizeRecommendation)
      : [],
    model: GEMINI_MODELS.TEXT,
    tokens: {
      input: result.inputTokens,
      output: result.outputTokens,
    },
    generatedAt: new Date().toISOString(),
  };
}

function parseJsonReport(raw: string): any {
  if (!raw) return {};
  // Strip markdown fences if model added them despite instructions
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: extract first {...} block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return {};
      }
    }
    return {};
  }
}

function clampInt(v: any, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

function normalizeInsight(i: any): BrandHealthInsight {
  const level = ['pass', 'warn', 'fail'].includes(i?.level) ? i.level : 'warn';
  const category = ['identity', 'visual', 'strategy', 'voice', 'tokens', 'coherence'].includes(
    i?.category
  )
    ? i.category
    : 'coherence';
  return {
    level,
    category,
    title: String(i?.title || '').slice(0, 120),
    detail: String(i?.detail || '').slice(0, 400),
  };
}

function normalizeRecommendation(r: any): BrandHealthRecommendation {
  return {
    action: String(r?.action || '').slice(0, 200),
    reason: String(r?.reason || '').slice(0, 400),
  };
}
