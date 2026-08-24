import React from 'react';
import { cn } from '@/lib/utils';
import type { MockTokens } from './mockTokens';
import { buildRoleTheme, readableOn } from './mockTokens';
import { Artboard } from './Artboard';
import { FitText } from './FitText';
import type { BrandColorTheme } from '@/lib/figma-types';

/** User-editable content overrides (the "trocar textos/variáveis" lever). */
export interface MockOverrides {
  name?: string;
  tagline?: string;
  headline?: string;
  body?: string;
}

interface MockProps {
  tokens: MockTokens;
  className?: string;
  /** Forwarded to the Artboard's fixed inner node — the export/capture target. */
  exportRef?: React.Ref<HTMLDivElement>;
  /** Color-combination index (algorithmic re-skin of the same brand palette). */
  variant?: number;
  /** Editable text overrides; fall back to brand-derived content when empty. */
  overrides?: MockOverrides;
}

/** Resolve display content once per mock: override → brand token → sensible default. */
export function resolveContent(tokens: MockTokens, o?: MockOverrides) {
  const name = o?.name?.trim() || tokens.name;
  const tagline = o?.tagline?.trim() || tokens.tagline || '';
  const headline =
    o?.headline?.trim() || firstSentence(tokens.manifestoFirstLine) || tagline || `${name}.`;
  const body = o?.body?.trim() || firstSentence(tokens.description) || '';
  return { name, tagline, headline, body };
}

type ResolvedTheme = { bg: string; text: string; primary: string; accent: string };

/** Pick a media URL by category, cycling by index */
function pickMedia(
  tokens: MockTokens,
  category: keyof MockTokens['mediaByCategory'],
  index = 0
): string | undefined {
  const urls = tokens.mediaByCategory[category];
  return urls.length > 0 ? urls[index % urls.length] : undefined;
}

/** Pick a colorTheme by index (wraps around), or fall back to the main BrandTheme */
function pickColorTheme(tokens: MockTokens, index: number): ResolvedTheme {
  const ct = tokens.colorThemes;
  if (ct.length > 0) {
    const t: BrandColorTheme = ct[index % ct.length];
    return { bg: t.bg, text: t.text, primary: t.primary, accent: t.accent };
  }
  const { theme } = tokens;
  return { bg: theme.bg, text: theme.text, primary: theme.accent, accent: theme.accent };
}

/** Truncate text at word boundary, adding ellipsis if needed */
function smartTrunc(text: string | undefined, max: number): string {
  if (!text) return '';
  if (text.length <= max) return text;
  // Find last space before max, then trim trailing punctuation
  const cut = text.lastIndexOf(' ', max);
  const end = cut > max * 0.4 ? cut : max;
  return text.slice(0, end).replace(/[,;:\s]+$/, '') + '…';
}

/**
 * First complete sentence (up to the first . ! ?) — for headlines/body that read as a
 * finished thought instead of a mid-word `…` cut. Falls back to the whole string when
 * there's no terminal punctuation. If the sentence is very long, degrades to a clean
 * word-boundary trim (still no mid-word break).
 */
function firstSentence(text: string | undefined, softMax = 120): string {
  if (!text) return '';
  const m = text.match(/^(.*?[.!?])(\s|$)/);
  const s = (m ? m[1] : text).trim();
  return s.length > softMax ? smartTrunc(s, softMax) : s;
}

const Logo: React.FC<{ tokens: MockTokens; mode?: 'light' | 'dark' | 'auto'; size?: number }> = ({
  tokens,
  mode = 'auto',
  size = 28,
}) => {
  const logo =
    (mode === 'light' && tokens.lightLogo) ||
    (mode === 'dark' && tokens.darkLogo) ||
    tokens.primaryLogo ||
    tokens.iconLogo;

  if (logo) {
    return (
      <img
        src={logo.url}
        alt={tokens.name || 'Brand logo'}
        style={{ height: size, width: 'auto', objectFit: 'contain', maxWidth: size * 4 }}
      />
    );
  }
  const displayName = tokens.name || 'Brand';
  return (
    <span
      className="font-bold tracking-tight"
      style={{ fontFamily: tokens.headingFamily, fontSize: size * 0.72 }}
    >
      {displayName}
    </span>
  );
};

// ── Instagram Feed (1080×1080) ───────────────────────────────────────────────
// Fixed-px artboard — mirrors `[Template] Instagram` in Figma exactly (padding 72,
// headline Unbounded 104/0.95, swatches 30, role-color theme).
export const InstagramFeedMock: React.FC<MockProps> = ({
  tokens,
  className,
  exportRef,
  variant = 0,
  overrides,
}) => {
  const t = buildRoleTheme(tokens, variant);
  const c = resolveContent(tokens, overrides);
  const swatches = [t.primary, t.secondary, t.accent, t.text];
  return (
    <Artboard w={1080} h={1080} className={className} exportRef={exportRef}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: t.bg,
          color: t.text,
          borderRadius: 40,
          padding: 72,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo tokens={tokens} size={64} />
          <span
            style={{ fontFamily: tokens.bodyFamily, fontSize: 22, letterSpacing: 4, opacity: 0.5 }}
          >
            01 / Brand
          </span>
        </div>

        <div
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}
        >
          <span
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 26,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: t.accent,
            }}
          >
            {c.tagline || 'New chapter'}
          </span>
          <FitText
            maxFontSize={104}
            minFontSize={44}
            maxWidth={936}
            maxHeight={470}
            lineHeight={0.95}
            style={{
              fontFamily: tokens.headingFamily,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: t.text,
            }}
          >
            {c.headline}
          </FitText>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {swatches.map((hex, i) => (
              <span
                key={i}
                style={{ width: 30, height: 30, borderRadius: '50%', background: hex }}
              />
            ))}
          </div>
          <span
            style={{ fontFamily: tokens.bodyFamily, fontSize: 22, letterSpacing: 4, opacity: 0.45 }}
          >
            @{c.name.toLowerCase().replace(/\s+/g, '')}
          </span>
        </div>
      </div>
    </Artboard>
  );
};

// ── LinkedIn Post (1200×628) ─────────────────────────────────────────────────
// Fixed-px artboard — mirrors `[Template] LinkedIn` (colored left panel + headline).
export const LinkedInPostMock: React.FC<MockProps> = ({
  tokens,
  className,
  exportRef,
  variant = 0,
  overrides,
}) => {
  const t = buildRoleTheme(tokens, variant);
  const c = resolveContent(tokens, overrides);
  return (
    <Artboard w={1200} h={628} className={className} exportRef={exportRef}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          background: t.bg,
          color: t.text,
          borderRadius: 32,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 400,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 44,
            background: t.primary,
            color: t.accentText,
          }}
        >
          <Logo tokens={tokens} size={52} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span
              style={{
                fontFamily: tokens.bodyFamily,
                fontSize: 20,
                letterSpacing: 4,
                textTransform: 'uppercase',
                opacity: 0.75,
              }}
            >
              Insight
            </span>
            <span style={{ fontFamily: tokens.bodyFamily, fontSize: 24, opacity: 0.9 }}>
              {c.tagline || c.name}
            </span>
          </div>
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '44px 60px',
            gap: 16,
          }}
        >
          <span
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 20,
              letterSpacing: 6,
              textTransform: 'uppercase',
              opacity: 0.85,
              color: t.accent,
            }}
          >
            {c.name}
          </span>
          <FitText
            maxFontSize={66}
            minFontSize={32}
            maxWidth={680}
            maxHeight={300}
            lineHeight={1.05}
            style={{
              fontFamily: tokens.headingFamily,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: t.text,
            }}
          >
            {c.headline}
          </FitText>
          <p
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 24,
              lineHeight: 1.35,
              color: t.textMuted,
            }}
          >
            {c.body || 'Use this space for the body copy that supports your headline.'}
          </p>
        </div>
      </div>
    </Artboard>
  );
};

// ── Poster (1080×1440) ───────────────────────────────────────────────────────
// Fixed-px artboard — mirrors `[Template] Poster` (centered logo, hero, divider).
export const PosterMock: React.FC<MockProps> = ({
  tokens,
  className,
  exportRef,
  variant = 0,
  overrides,
}) => {
  const t = buildRoleTheme(tokens, variant);
  const c = resolveContent(tokens, overrides);
  const swatches = [t.primary, t.secondary, t.accent, t.textMuted, t.text];
  return (
    <Artboard w={1080} h={1440} className={className} exportRef={exportRef}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: t.bg,
          color: t.text,
          borderRadius: 36,
          padding: 76,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 22,
              letterSpacing: 4,
              textTransform: 'uppercase',
              opacity: 0.6,
            }}
          >
            {c.name}
          </span>
          <span
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 22,
              letterSpacing: 4,
              textTransform: 'uppercase',
              opacity: 0.4,
            }}
          >
            {new Date().getFullYear()}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 44,
            textAlign: 'center',
          }}
        >
          <Logo tokens={tokens} size={72} />
          <FitText
            maxFontSize={104}
            minFontSize={44}
            maxWidth={928}
            maxHeight={470}
            lineHeight={0.94}
            style={{
              fontFamily: tokens.headingFamily,
              fontWeight: 500,
              letterSpacing: '-0.03em',
              textAlign: 'center',
              color: t.text,
              marginInline: 'auto',
            }}
          >
            {c.headline}
          </FitText>
          <span style={{ width: 90, height: 4, background: t.accent }} />
          <p
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 26,
              lineHeight: 1.45,
              maxWidth: 760,
              opacity: 0.85,
              color: t.textMuted,
            }}
          >
            {c.body || c.tagline}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {swatches.map((hex, i) => (
              <span key={i} style={{ width: 44, height: 10, background: hex }} />
            ))}
          </div>
          <span
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 20,
              letterSpacing: 3,
              textTransform: 'uppercase',
              opacity: 0.4,
            }}
          >
            #{c.name.toLowerCase().replace(/\s+/g, '')}
          </span>
        </div>
      </div>
    </Artboard>
  );
};

// ── Stories (1080×1920) ──────────────────────────────────────────────────────
// Fixed-px artboard — mirrors `[Template] Stories` (progress bars, avatar, CTA).
export const StoriesMock: React.FC<MockProps> = ({
  tokens,
  className,
  exportRef,
  variant = 0,
  overrides,
}) => {
  const t = buildRoleTheme(tokens, variant);
  const c = resolveContent(tokens, overrides);
  const avatarLogo = tokens.iconLogo || tokens.primaryLogo;
  return (
    <Artboard w={1080} h={1920} className={className} exportRef={exportRef}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: t.bg,
          color: t.text,
          borderRadius: 40,
          padding: 64,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  overflow: 'hidden',
                  background: t.text,
                  position: 'relative',
                  opacity: 0.2,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: i === 0 ? '60%' : '0%',
                    background: t.primary,
                  }}
                />
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                background: t.bg,
                border: `3px solid ${t.primary}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {avatarLogo ? (
                <img
                  src={avatarLogo.url}
                  alt=""
                  style={{ width: '62%', height: '62%', objectFit: 'contain' }}
                />
              ) : (
                <span
                  style={{
                    fontFamily: tokens.headingFamily,
                    fontWeight: 500,
                    fontSize: 34,
                    color: t.primary,
                  }}
                >
                  {c.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span
              style={{
                fontFamily: tokens.bodyFamily,
                fontSize: 30,
                fontWeight: 600,
                color: t.text,
              }}
            >
              {c.name.toLowerCase()}
            </span>
          </div>
        </div>

        <FitText
          maxFontSize={96}
          minFontSize={40}
          maxWidth={952}
          maxHeight={780}
          lineHeight={0.98}
          style={{
            fontFamily: tokens.headingFamily,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            textAlign: 'center',
            color: t.text,
            marginInline: 'auto',
          }}
        >
          {c.tagline || c.headline}
        </FitText>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <span
            style={{
              padding: '22px 40px',
              borderRadius: 100,
              background: t.primary,
              color: t.accentText,
              fontFamily: tokens.bodyFamily,
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            Ver mais
          </span>
          <span
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 20,
              letterSpacing: 4,
              textTransform: 'uppercase',
              opacity: 0.4,
            }}
          >
            arraste pra cima
          </span>
        </div>
      </div>
    </Artboard>
  );
};

// ── Website Hero (1920×1080) ─────────────────────────────────────────────────
// Fixed-px artboard — mirrors `[Template] Website` (nav, hero + buttons, footer).
export const WebsiteHeroMock: React.FC<MockProps> = ({
  tokens,
  className,
  exportRef,
  variant = 0,
  overrides,
}) => {
  const t = buildRoleTheme(tokens, variant);
  const c = resolveContent(tokens, overrides);
  const swatches = [t.primary, t.secondary, t.accent, t.textMuted, t.text];
  const link = {
    fontFamily: tokens.bodyFamily,
    fontSize: 20,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  };
  const btn = {
    padding: '16px 32px',
    borderRadius: 12,
    fontFamily: tokens.bodyFamily,
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  };
  return (
    <Artboard w={1920} h={1080} className={className} exportRef={exportRef}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          background: t.bg,
          color: t.text,
          borderRadius: 32,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '40px 64px',
          }}
        >
          <Logo tokens={tokens} size={48} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
            {['Sobre', 'Produto', 'Contato'].map((l) => (
              <span key={l} style={{ ...link, opacity: 0.55 }}>
                {l}
              </span>
            ))}
            <span style={{ ...btn, background: t.primary, color: t.accentText }}>Começar</span>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 100px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1180 }}>
            <span
              style={{
                fontFamily: tokens.bodyFamily,
                fontSize: 22,
                letterSpacing: 6,
                textTransform: 'uppercase',
                opacity: 0.85,
                color: t.accent,
              }}
            >
              {c.tagline || c.name}
            </span>
            <FitText
              maxFontSize={120}
              minFontSize={52}
              maxWidth={1180}
              maxHeight={430}
              lineHeight={0.96}
              style={{
                fontFamily: tokens.headingFamily,
                fontWeight: 500,
                letterSpacing: '-0.03em',
                color: t.text,
              }}
            >
              {c.headline}
            </FitText>
            <p
              style={{
                fontFamily: tokens.bodyFamily,
                fontSize: 28,
                lineHeight: 1.4,
                maxWidth: 1000,
                color: t.textMuted,
              }}
            >
              {c.body || 'Build something extraordinary with a brand that stands out.'}
            </p>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <span style={{ ...btn, background: t.primary, color: t.accentText }}>
                Começar agora
              </span>
              <span
                style={{
                  ...btn,
                  background: 'transparent',
                  color: t.text,
                  border: `2px solid ${t.text}40`,
                }}
              >
                Saiba mais
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '32px 64px',
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            {swatches.map((hex, i) => (
              <span
                key={i}
                style={{ width: 22, height: 22, borderRadius: '50%', background: hex }}
              />
            ))}
          </div>
          <span
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 18,
              letterSpacing: 3,
              textTransform: 'uppercase',
              opacity: 0.4,
            }}
          >
            {c.name} · {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </Artboard>
  );
};

// ── Business Card (1050×600) ─────────────────────────────────────────────────
// Fixed-px artboard — mirrors `[Template] Business Card` (accent stripe, identity).
export const BusinessCardMock: React.FC<MockProps> = ({
  tokens,
  className,
  exportRef,
  variant = 0,
  overrides,
}) => {
  const t = buildRoleTheme(tokens, variant);
  const c = resolveContent(tokens, overrides);
  const dots = [t.primary, t.secondary, t.accent];
  return (
    <Artboard w={1050} h={600} className={className} exportRef={exportRef}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          background: t.bg,
          color: t.text,
          borderRadius: 28,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: 16, height: '100%', background: t.primary }} />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '56px 64px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Logo tokens={tokens} size={48} />
            <div style={{ display: 'flex', gap: 8 }}>
              {dots.map((hex, i) => (
                <span
                  key={i}
                  style={{ width: 16, height: 16, borderRadius: '50%', background: hex }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3
              style={{
                fontFamily: tokens.headingFamily,
                fontWeight: 500,
                fontSize: 46,
                color: t.text,
              }}
            >
              Jane Doe
            </h3>
            <p
              style={{
                fontFamily: tokens.bodyFamily,
                fontSize: 20,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: t.accent,
              }}
            >
              Creative Director
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontFamily: tokens.bodyFamily, fontSize: 18, opacity: 0.5 }}>
                hello@{c.name.toLowerCase().replace(/\s+/g, '')}.com
              </p>
              <p style={{ fontFamily: tokens.bodyFamily, fontSize: 18, opacity: 0.5 }}>
                +1 (555) 000-0000
              </p>
            </div>
            <span
              style={{
                fontFamily: tokens.bodyFamily,
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 3,
                textTransform: 'uppercase',
                opacity: 0.35,
              }}
            >
              {c.name}
            </span>
          </div>
        </div>
      </div>
    </Artboard>
  );
};

// ── X / Twitter Profile (16:10) ─────────────────────────────────────────────
export const XProfileMock: React.FC<MockProps> = ({ tokens, className }) => {
  const ct = pickColorTheme(tokens, 0);
  const { theme } = tokens;
  const handle = tokens.name.toLowerCase().replace(/\s+/g, '');
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-2xl shadow-2xl', className)}
      style={{ aspectRatio: '16 / 10', background: ct.bg, color: ct.text }}
    >
      <div className="absolute inset-0 flex flex-col">
        <div className="h-[35%] w-full" style={{ background: ct.primary }} />
        <div className="flex-1 flex flex-col px-[5%] pb-[4%]">
          <div className="flex items-end justify-between -mt-[7%]">
            <div
              className="w-[18%] aspect-square rounded-full border-[3px] flex items-center justify-center overflow-hidden"
              style={{ borderColor: ct.bg, background: ct.bg }}
            >
              {tokens.iconLogo ? (
                <img src={tokens.iconLogo.url} alt="" className="w-[65%] h-[65%] object-contain" />
              ) : tokens.primaryLogo ? (
                <img
                  src={tokens.primaryLogo.url}
                  alt=""
                  className="w-[65%] h-[65%] object-contain"
                />
              ) : (
                <span
                  className="font-bold"
                  style={{
                    fontFamily: tokens.headingFamily,
                    fontSize: 'clamp(14px, 3cqi, 28px)',
                    color: ct.primary,
                  }}
                >
                  {tokens.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span
              className="px-4 py-1.5 rounded-full text-2xs font-semibold uppercase tracking-wider"
              style={{
                background: ct.primary,
                color: theme.accentText,
                fontFamily: tokens.bodyFamily,
              }}
            >
              Seguir
            </span>
          </div>

          <div className="mt-[3%] space-y-1">
            <div className="flex items-center gap-1">
              <h3
                className="font-bold tracking-tight"
                style={{ fontFamily: tokens.headingFamily, fontSize: 'clamp(14px, 3cqi, 24px)' }}
              >
                {tokens.name}
              </h3>
              <svg
                viewBox="0 0 22 22"
                className="w-[1em] h-[1em]"
                style={{ fontSize: 'clamp(12px, 2.5cqi, 20px)' }}
              >
                <path
                  d="M20.4 11l-1.4-1.6.2-2.1-2.1-.5-1-1.9-2 .7L11 4.2 7.9 5.6l-2-.7-1 1.9-2.1.5.2 2.1L1.6 11 3 12.6l-.2 2.1 2.1.5 1 1.9 2-.7 3.1 1.4 3.1-1.4 2 .7 1-1.9 2.1-.5-.2-2.1L20.4 11z"
                  fill={ct.primary}
                />
                <path
                  d="M9.7 14.8l-3-3 1.4-1.4 1.6 1.6 4.2-4.2 1.4 1.4-5.6 5.6z"
                  fill={theme.accentText}
                />
              </svg>
            </div>
            <p
              className="opacity-50"
              style={{ fontFamily: tokens.bodyFamily, fontSize: 'clamp(9px, 1.8cqi, 14px)' }}
            >
              @{handle}
            </p>
          </div>

          <p
            className="mt-[3%] opacity-70 leading-relaxed"
            style={{ fontFamily: tokens.bodyFamily, fontSize: 'clamp(9px, 1.6cqi, 13px)' }}
          >
            {smartTrunc(tokens.description, 80) ||
              smartTrunc(tokens.tagline, 80) ||
              `Assets by creatives → for creatives`}
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Social Card / White (4:5) ───────────────────────────────────────────────
export const SocialCardMock: React.FC<MockProps> = ({ tokens, className }) => {
  const ct = pickColorTheme(tokens, 1);
  const { theme } = tokens;
  const handle = tokens.name.toLowerCase().replace(/\s+/g, '');
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-[28px] shadow-2xl', className)}
      style={{ aspectRatio: '4 / 5', background: ct.bg, color: ct.text }}
    >
      <div className="absolute inset-0 flex flex-col p-[4%] gap-[5%]">
        <div
          className="flex-1 rounded-[24px] overflow-hidden flex flex-col items-center justify-start pt-[8%] gap-[2%] relative"
          style={{ background: `${ct.primary}18` }}
        >
          <h3
            className="font-bold tracking-tight text-center relative z-10"
            style={{
              fontFamily: tokens.headingFamily,
              fontSize: 'clamp(16px, 4.5cqi, 32px)',
              color: ct.text,
            }}
          >
            {smartTrunc(tokens.tagline, 30) || tokens.name}
          </h3>
          <p
            className="opacity-60 text-center relative z-10"
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 'clamp(9px, 2cqi, 16px)',
              color: ct.text,
            }}
          >
            {smartTrunc(tokens.description, 35) || 'Os melhores do mundo!'}
          </p>
        </div>

        <div className="flex items-center justify-between px-[2%]">
          <div className="flex items-center gap-[3%]">
            <div
              className="w-[12%] aspect-square rounded-full flex items-center justify-center overflow-hidden"
              style={{ background: ct.bg, border: `2px solid ${ct.text}15` }}
            >
              {tokens.iconLogo ? (
                <img src={tokens.iconLogo.url} alt="" className="w-[70%] h-[70%] object-contain" />
              ) : (
                <span
                  className="font-bold"
                  style={{
                    fontFamily: tokens.headingFamily,
                    fontSize: 'clamp(10px, 2cqi, 16px)',
                    color: ct.primary,
                  }}
                >
                  {tokens.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <span
                className="font-bold"
                style={{
                  fontFamily: tokens.bodyFamily,
                  fontSize: 'clamp(9px, 1.8cqi, 14px)',
                  color: ct.text,
                }}
              >
                @{handle}
              </span>
              <span
                className="opacity-40"
                style={{
                  fontFamily: tokens.bodyFamily,
                  fontSize: 'clamp(7px, 1.3cqi, 10px)',
                  color: ct.text,
                }}
              >
                Há 5 minutos
              </span>
            </div>
          </div>
          <span
            className="px-4 py-1.5 rounded-full text-3xs font-semibold uppercase tracking-wider"
            style={{
              background: ct.primary,
              color: theme.accentText,
              fontFamily: tokens.bodyFamily,
            }}
          >
            + Adicionar
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Notification / Push (5:1) ───────────────────────────────────────────────
export const NotificationMock: React.FC<MockProps> = ({ tokens, className }) => {
  const ct = pickColorTheme(tokens, 0);
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-2xl shadow-2xl', className)}
      style={{ aspectRatio: '5 / 2', background: ct.bg, color: ct.text }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3%] px-[6%]">
        <div
          className="absolute inset-x-[12%] bottom-[18%] h-[38%] rounded-[20px] opacity-20"
          style={{ background: '#fff' }}
        />
        <div
          className="absolute inset-x-[8%] bottom-[22%] h-[38%] rounded-[22px] opacity-50"
          style={{ background: '#fff' }}
        />

        <div
          className="relative z-10 flex items-center gap-[4%] w-[85%] rounded-[22px] px-[4%] py-[3.5%]"
          style={{ background: '#ffffff', color: '#161616' }}
        >
          <div
            className="w-[14%] aspect-square rounded-[18%] flex items-center justify-center overflow-hidden shrink-0"
            style={{ background: `${ct.primary}15` }}
          >
            {tokens.iconLogo ? (
              <img src={tokens.iconLogo.url} alt="" className="w-[70%] h-[70%] object-contain" />
            ) : tokens.primaryLogo ? (
              <img src={tokens.primaryLogo.url} alt="" className="w-[70%] h-[70%] object-contain" />
            ) : (
              <span
                className="font-bold"
                style={{
                  fontFamily: tokens.headingFamily,
                  fontSize: 'clamp(14px, 3cqi, 24px)',
                  color: ct.primary,
                }}
              >
                {tokens.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4
                className="font-bold tracking-tight truncate"
                style={{ fontFamily: tokens.headingFamily, fontSize: 'clamp(12px, 2.8cqi, 22px)' }}
              >
                {tokens.name}
              </h4>
              <span
                className="opacity-40 shrink-0 ml-2"
                style={{ fontFamily: tokens.bodyFamily, fontSize: 'clamp(8px, 1.4cqi, 12px)' }}
              >
                Há 1 min
              </span>
            </div>
            <p
              className="font-semibold mt-0.5"
              style={{ fontFamily: tokens.bodyFamily, fontSize: 'clamp(9px, 2cqi, 16px)' }}
            >
              {tokens.tagline ? smartTrunc(tokens.tagline, 25) : 'Mockup Alert'}
            </p>
            <p
              className="opacity-60 truncate"
              style={{ fontFamily: tokens.bodyFamily, fontSize: 'clamp(8px, 1.6cqi, 13px)' }}
            >
              {smartTrunc(tokens.description, 50) || 'Assets by creatives → for creatives'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── App Store Card (2:3) ────────────────────────────────────────────────────
export const AppStoreMock: React.FC<MockProps> = ({ tokens, className }) => {
  const ct = pickColorTheme(tokens, 1);
  const { theme } = tokens;
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-2xl shadow-2xl', className)}
      style={{ aspectRatio: '2 / 3', background: ct.bg, color: ct.text }}
    >
      <div className="absolute inset-0 flex flex-col p-[7%]">
        <div
          className="w-[28%] aspect-square rounded-[22%] flex items-center justify-center overflow-hidden mb-[6%]"
          style={{ background: `${ct.primary}15`, boxShadow: `0 8px 32px ${ct.primary}22` }}
        >
          {tokens.iconLogo ? (
            <img src={tokens.iconLogo.url} alt="" className="w-[60%] h-[60%] object-contain" />
          ) : tokens.primaryLogo ? (
            <img src={tokens.primaryLogo.url} alt="" className="w-[60%] h-[60%] object-contain" />
          ) : (
            <span
              className="font-bold"
              style={{
                fontFamily: tokens.headingFamily,
                fontSize: 'clamp(20px, 5cqi, 40px)',
                color: ct.primary,
              }}
            >
              {tokens.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <h2
          className="font-bold leading-tight tracking-tight"
          style={{ fontFamily: tokens.headingFamily, fontSize: 'clamp(18px, 5cqi, 36px)' }}
        >
          {tokens.name}
        </h2>
        <p
          className="opacity-50 mt-1"
          style={{
            fontFamily: tokens.bodyFamily,
            fontSize: 'clamp(9px, 2cqi, 14px)',
            color: ct.accent,
          }}
        >
          {smartTrunc(tokens.tagline, 40) || 'Creative tools for everyone'}
        </p>

        <div className="flex-1" />

        <div
          className="w-full aspect-[9/14] rounded-xl overflow-hidden mb-[5%]"
          style={{ background: `${ct.primary}0A`, border: `1px solid ${ct.text}10` }}
        >
          {pickMedia(tokens, 'product') ? (
            <img
              src={pickMedia(tokens, 'product')!}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Logo tokens={tokens} size={48} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <svg
                key={i}
                viewBox="0 0 12 12"
                className="w-[10px] h-[10px]"
                style={{ fill: i <= 4 ? ct.primary : `${ct.text}20` }}
              >
                <path d="M6 0l1.8 3.7 4.2.6-3 2.9.7 4.1L6 9.5 2.3 11.3l.7-4.1-3-2.9 4.2-.6z" />
              </svg>
            ))}
            <span className="text-3xs opacity-40 ml-1" style={{ fontFamily: tokens.bodyFamily }}>
              4.8
            </span>
          </div>
          <span
            className="px-3 py-1 rounded-full text-3xs uppercase tracking-widest font-bold"
            style={{
              background: ct.primary,
              color: theme.accentText,
              fontFamily: tokens.bodyFamily,
            }}
          >
            GET
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Letterhead (A4 ~ 1:1.414) ───────────────────────────────────────────────
export const LetterheadMock: React.FC<MockProps> = ({ tokens, className }) => {
  const ct = pickColorTheme(tokens, 0);
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-xl shadow-2xl', className)}
      style={{ aspectRatio: '1 / 1.414', background: '#ffffff', color: '#1a1a1a' }}
    >
      <div className="absolute inset-0 flex flex-col">
        <div
          className="flex items-center justify-between px-[8%] py-[5%]"
          style={{ borderBottom: `2px solid ${ct.primary}` }}
        >
          <Logo tokens={tokens} size={28} mode="dark" />
          <div className="flex flex-col items-end">
            <span className="text-3xs opacity-40" style={{ fontFamily: tokens.bodyFamily }}>
              hello@{tokens.name.toLowerCase().replace(/\s+/g, '')}.com
            </span>
            <span className="text-3xs opacity-40" style={{ fontFamily: tokens.bodyFamily }}>
              {tokens.name.toLowerCase().replace(/\s+/g, '')}.com
            </span>
          </div>
        </div>

        {/* Body placeholder lines */}
        <div className="flex-1 px-[8%] py-[8%] flex flex-col gap-[3%]">
          <div
            className="h-[2px] w-[30%] rounded-full opacity-15"
            style={{ background: '#1a1a1a' }}
          />
          <div
            className="h-[2px] w-full rounded-full opacity-8"
            style={{ background: '#1a1a1a' }}
          />
          <div
            className="h-[2px] w-full rounded-full opacity-8"
            style={{ background: '#1a1a1a' }}
          />
          <div
            className="h-[2px] w-[85%] rounded-full opacity-8"
            style={{ background: '#1a1a1a' }}
          />
          <div
            className="h-[2px] w-full rounded-full opacity-8"
            style={{ background: '#1a1a1a' }}
          />
          <div
            className="h-[2px] w-[60%] rounded-full opacity-8"
            style={{ background: '#1a1a1a' }}
          />
          <div className="mt-auto" />
          <div
            className="h-[2px] w-[25%] rounded-full opacity-12"
            style={{ background: '#1a1a1a' }}
          />
          <div
            className="h-[2px] w-[20%] rounded-full opacity-10"
            style={{ background: '#1a1a1a' }}
          />
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-[8%] py-[3%]"
          style={{ borderTop: `1px solid ${ct.primary}33` }}
        >
          <div className="flex gap-1.5">
            {tokens.palette.slice(0, 4).map((c, i) => (
              <span key={i} className="w-2 h-2 rounded-full" style={{ background: c.hex }} />
            ))}
          </div>
          <span
            className="text-3xs opacity-30 uppercase tracking-widest"
            style={{ fontFamily: tokens.bodyFamily }}
          >
            {tokens.name}
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Presentation Slide (16:9) ───────────────────────────────────────────────
export const PresentationSlideMock: React.FC<MockProps> = ({ tokens, className }) => {
  const ct = pickColorTheme(tokens, 0);
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-2xl shadow-2xl', className)}
      style={{ aspectRatio: '16 / 9', background: ct.bg, color: ct.text }}
    >
      <div className="absolute inset-0 flex">
        <div className="flex-1 flex flex-col justify-between p-[6%]">
          <div className="flex items-center gap-2">
            <Logo tokens={tokens} size={20} />
            <span
              className="text-3xs opacity-30 uppercase tracking-widest"
              style={{ fontFamily: tokens.bodyFamily }}
            >
              Brand Deck
            </span>
          </div>

          <div className="max-w-[90%]">
            <span
              className="text-3xs uppercase tracking-[0.4em] opacity-50 block mb-2"
              style={{ fontFamily: tokens.bodyFamily, color: ct.accent }}
            >
              {tokens.tagline || 'Introduction'}
            </span>
            <h1
              className="font-bold leading-[0.92] tracking-tight"
              style={{ fontFamily: tokens.headingFamily, fontSize: 'clamp(18px, 4.5cqi, 40px)' }}
            >
              {smartTrunc(tokens.manifestoFirstLine, 35) ||
                smartTrunc(tokens.description, 35) ||
                `This is ${tokens.name}`}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {tokens.palette.slice(0, 5).map((c, i) => (
                <span key={i} className="w-6 h-1.5 rounded-sm" style={{ background: c.hex }} />
              ))}
            </div>
            <span className="text-3xs opacity-30" style={{ fontFamily: tokens.bodyFamily }}>
              01
            </span>
          </div>
        </div>

        <div
          className="w-[38%] flex items-center justify-center relative"
          style={{ background: ct.primary }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{ background: `radial-gradient(circle at 30% 50%, ${ct.bg}, transparent 70%)` }}
          />
          <div className="relative z-10 opacity-90">
            <Logo tokens={tokens} size={64} mode="auto" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Email Header (1200×400) ──────────────────────────────────────────────────
// Fixed-px artboard — mirrors `[Template] Email` (logo panel, copy, action).
export const EmailHeaderMock: React.FC<MockProps> = ({
  tokens,
  className,
  exportRef,
  variant = 0,
  overrides,
}) => {
  const t = buildRoleTheme(tokens, variant);
  const c = resolveContent(tokens, overrides);
  return (
    <Artboard w={1200} h={400} className={className} exportRef={exportRef}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          background: t.bg,
          color: t.text,
          borderRadius: 28,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 320,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: t.primary,
          }}
        >
          <Logo tokens={tokens} size={44} mode="auto" />
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 48px',
            gap: 12,
          }}
        >
          <FitText
            maxFontSize={40}
            minFontSize={22}
            maxWidth={784}
            maxHeight={100}
            lineHeight={1.1}
            style={{ fontFamily: tokens.headingFamily, fontWeight: 500, color: t.text }}
          >
            {c.tagline || `${c.name} Newsletter`}
          </FitText>
          <p
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 22,
              lineHeight: 1.35,
              color: t.textMuted,
            }}
          >
            {c.body || 'Stay updated with the latest from our team.'}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 12,
            paddingRight: 48,
          }}
        >
          <span
            style={{
              padding: '14px 26px',
              borderRadius: 10,
              background: t.primary,
              color: t.accentText,
              fontFamily: tokens.bodyFamily,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Ler mais
          </span>
          <span style={{ fontFamily: tokens.bodyFamily, fontSize: 16, opacity: 0.35 }}>
            Descadastrar
          </span>
        </div>
      </div>
    </Artboard>
  );
};

// ── Editorial presets (adapted from the Visant Design Library) ────────────────

/** Split a short phrase into two balanced halves — for split-tagline lockups. */
export function splitTwo(text?: string): [string, string] {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [words[0] || '', ''];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

// ── Editorial Story / Manifesto (1080×1920) ──────────────────────────────────
export const EditorialStoryMock: React.FC<MockProps> = ({
  tokens,
  className,
  exportRef,
  variant = 0,
  overrides,
}) => {
  const t = buildRoleTheme(tokens, variant);
  const c = resolveContent(tokens, overrides);
  const bg = t.secondary;
  const fg = readableOn(bg) === '#ffffff' ? t.bg : t.text;
  const body =
    overrides?.body?.trim() || tokens.manifesto || c.body || tokens.description || c.tagline;
  const words = tokens.keywords.length
    ? tokens.keywords
    : (c.tagline || c.name)
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 4);
  const lines = Array.from({ length: 16 }, (_, i) => ({
    y: 70 + i * 108,
    x: 560 + ((i * 91) % 340),
    w: 120 + ((i * 137) % 520),
  }));
  return (
    <Artboard w={1080} h={1920} className={className} exportRef={exportRef}>
      <div
        style={{ position: 'absolute', inset: 0, background: bg, color: fg, overflow: 'hidden' }}
      >
        <svg
          viewBox="0 0 1080 1920"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.14 }}
        >
          {lines.map((l, i) => (
            <g key={i} stroke={fg} strokeWidth={2} fill="none">
              <line x1={l.x} y1={l.y} x2={l.x + l.w} y2={l.y} />
              <line x1={l.x} y1={l.y - 8} x2={l.x} y2={l.y + 8} />
              <line x1={l.x + l.w} y1={l.y - 8} x2={l.x + l.w} y2={l.y + 8} />
            </g>
          ))}
        </svg>

        <div style={{ position: 'absolute', top: 96, left: 96, right: 96 }}>
          <div
            style={{
              fontFamily: tokens.headingFamily,
              fontWeight: 600,
              fontSize: 40,
              letterSpacing: '0.02em',
            }}
          >
            {c.name}
          </div>
          <p
            style={{
              marginTop: 28,
              width: 560,
              fontFamily: tokens.bodyFamily,
              fontSize: 27,
              lineHeight: 1.5,
              textAlign: 'justify',
              opacity: 0.92,
            }}
          >
            {smartTrunc(body, 360)}
          </p>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 40,
            bottom: 90,
            transform: 'rotate(-9deg)',
            transformOrigin: 'left bottom',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                fontFamily: tokens.headingFamily,
                fontWeight: 500,
                fontSize: 128,
                lineHeight: 1,
                marginLeft: i * 90,
                textTransform: 'lowercase',
                whiteSpace: 'nowrap',
              }}
            >
              {w}
            </span>
          ))}
        </div>
      </div>
    </Artboard>
  );
};

// ── Card Scatter Hero (1920×1080) ────────────────────────────────────────────
export const CardScatterMock: React.FC<MockProps> = ({
  tokens,
  className,
  exportRef,
  variant = 0,
  overrides,
}) => {
  const t = buildRoleTheme(tokens, variant);
  const c = resolveContent(tokens, overrides);
  const year = new Date().getFullYear();
  const [tagL, tagR] = splitTwo(c.tagline || c.name);
  const scatter = [
    { l: '-6%', top: '-14%', r: -12, light: false },
    { l: '58%', top: '-20%', r: 10, light: true },
    { l: '78%', top: '32%', r: -8, light: false },
    { l: '0%', top: '56%', r: 8, light: true },
    { l: '30%', top: '74%', r: -14, light: false },
    { l: '64%', top: '66%', r: 12, light: true },
    { l: '-12%', top: '26%', r: 6, light: false },
  ];
  const Card: React.FC<{ light: boolean }> = ({ light }) => (
    <div
      style={{
        width: 460,
        height: 288,
        borderRadius: 20,
        background: light ? t.surface : t.accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontFamily: tokens.headingFamily,
          fontWeight: 600,
          fontSize: 92,
          color: light ? t.text : t.accentText,
          opacity: 0.9,
          whiteSpace: 'nowrap',
        }}
      >
        {c.name}
      </span>
    </div>
  );
  return (
    <Artboard w={1920} h={1080} className={className} exportRef={exportRef}>
      <div style={{ position: 'absolute', inset: 0, background: t.text, overflow: 'hidden' }}>
        {scatter.map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: s.l,
              top: s.top,
              transform: `rotate(${s.r}deg)`,
              opacity: 0.5,
            }}
          >
            <Card light={s.light} />
          </div>
        ))}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 780,
            borderRadius: 28,
            background: t.surface,
            color: t.text,
            padding: '44px 56px',
            boxShadow: '0 40px 120px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: tokens.bodyFamily,
              fontSize: 18,
              color: t.accent,
            }}
          >
            <span style={{ fontWeight: 600 }}>{c.name}</span>
            <span style={{ opacity: 0.7 }}>©{year}</span>
          </div>
          <div style={{ margin: '16px 0' }}>
            <FitText
              maxFontSize={140}
              minFontSize={44}
              maxWidth={668}
              maxHeight={190}
              lineHeight={1}
              style={{
                fontFamily: tokens.headingFamily,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                textAlign: 'center',
                color: t.text,
                marginInline: 'auto',
              }}
            >
              {c.name}
            </FitText>
          </div>
          <div style={{ height: 2, background: `${t.text}22`, margin: '0 0 16px' }} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 24,
              fontFamily: tokens.bodyFamily,
              fontSize: 20,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span>{tagL}</span>
            <span style={{ color: t.accent, textAlign: 'right' }}>{tagR || c.name}</span>
          </div>
        </div>
      </div>
    </Artboard>
  );
};

// ── Editorial Landing Hero (1920×1080) ───────────────────────────────────────
export const EditorialHeroMock: React.FC<MockProps> = ({
  tokens,
  className,
  exportRef,
  variant = 0,
  overrides,
}) => {
  const t = buildRoleTheme(tokens, variant);
  const c = resolveContent(tokens, overrides);
  const photo =
    pickMedia(tokens, 'stock') ||
    pickMedia(tokens, 'product') ||
    pickMedia(tokens, 'background') ||
    pickMedia(tokens, 'graphic');
  const caption = c.tagline || c.body;
  return (
    <Artboard w={1920} h={1080} className={className} exportRef={exportRef}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: t.bg,
          color: t.text,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 64,
            right: 64,
            bottom: 64,
            top: 300,
            borderRadius: 4,
            overflow: 'hidden',
            background: t.primary,
          }}
        >
          {photo ? (
            <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Logo tokens={tokens} size={96} mode="auto" />
            </div>
          )}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 64,
            top: 120,
            background: t.bg,
            paddingRight: 48,
            paddingBottom: 28,
            maxWidth: 1040,
          }}
        >
          <FitText
            maxFontSize={130}
            minFontSize={52}
            maxWidth={900}
            maxHeight={340}
            lineHeight={0.98}
            style={{
              fontFamily: tokens.headingFamily,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              color: t.text,
            }}
          >
            {c.headline}
          </FitText>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 64,
            top: 128,
            width: 300,
            fontFamily: tokens.bodyFamily,
            fontSize: 24,
            lineHeight: 1.4,
            color: t.textMuted,
          }}
        >
          {firstSentence(caption, 90)}
        </div>
      </div>
    </Artboard>
  );
};

// ── Brand Pattern / Cover (1920×1080) ────────────────────────────────────────
export const BrandPatternMock: React.FC<MockProps> = ({
  tokens,
  className,
  exportRef,
  variant = 0,
  overrides,
}) => {
  const t = buildRoleTheme(tokens, variant);
  const c = resolveContent(tokens, overrides);
  const palette = tokens.palette.length
    ? tokens.palette.map((p) => p.hex)
    : [t.accent, t.bg, t.primary, t.secondary, t.text];
  const cols = 6;
  const rows = 4;
  const cells = Array.from(
    { length: cols * rows },
    (_, i) => palette[(i * 3 + Math.floor(i / cols)) % palette.length]
  );
  return (
    <Artboard w={1920} h={1080} className={className} exportRef={exportRef}>
      <div style={{ position: 'absolute', inset: 0, background: t.text, overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            left: '-20%',
            top: '-30%',
            width: '140%',
            height: '160%',
            transform: 'rotate(-12deg)',
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gap: 12,
            background: t.text,
          }}
        >
          {cells.map((hex, i) => (
            <div key={i} style={{ background: hex }} />
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%,-50%)',
            background: t.surface,
            color: t.text,
            padding: '18px 44px',
            borderRadius: 100,
            fontFamily: tokens.headingFamily,
            fontWeight: 700,
            fontSize: 44,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          {c.name}
        </div>
      </div>
    </Artboard>
  );
};
