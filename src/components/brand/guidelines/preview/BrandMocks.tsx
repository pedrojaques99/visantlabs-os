import React from 'react';
import { cn } from '@/lib/utils';
import type { MockTokens } from './mockTokens';
import type { BrandColorTheme } from '@/lib/figma-types';

interface MockProps {
  tokens: MockTokens;
  className?: string;
}

type ResolvedTheme = { bg: string; text: string; primary: string; accent: string };

/** Pick a media URL by category, cycling by index */
function pickMedia(tokens: MockTokens, category: keyof MockTokens['mediaByCategory'], index = 0): string | undefined {
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

// ── Instagram Feed (1:1) ─────────────────────────────────────────────────────
export const InstagramFeedMock: React.FC<MockProps> = ({ tokens, className }) => {
  const ct = pickColorTheme(tokens, 0);
  const bgImage = pickMedia(tokens, 'background') || pickMedia(tokens, 'stock');
  return (
    <div
      className={cn('relative aspect-square w-full overflow-hidden rounded-2xl shadow-2xl', className)}
      style={{ background: ct.bg, color: ct.text }}
    >
      {bgImage && (
        <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
      )}
      <div className="absolute inset-0 flex flex-col p-[6%]">
        <div className="flex items-center justify-between">
          <Logo tokens={tokens} size={32} />
          <span
            className="text-[9px] uppercase tracking-[0.3em] opacity-50"
            style={{ fontFamily: tokens.bodyFamily }}
          >
            01 / Brand
          </span>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <span
            className="text-[10px] uppercase tracking-[0.4em] opacity-60 mb-3"
            style={{ fontFamily: tokens.bodyFamily, color: ct.accent }}
          >
            {tokens.tagline || 'New chapter'}
          </span>
          <h2
            className="font-bold leading-[0.95] tracking-tight"
            style={{
              fontFamily: tokens.headingFamily,
              fontSize: 'clamp(20px, 5.5cqi, 48px)',
              color: ct.text,
            }}
          >
            {smartTrunc(tokens.manifestoFirstLine, 50) ||
              smartTrunc(tokens.description, 50) ||
              `${tokens.name}.`}
          </h2>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            {tokens.palette.slice(0, 4).map((c, i) => (
              <span
                key={i}
                className="w-3 h-3 rounded-full border border-white/10"
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <span
            className="text-[9px] uppercase tracking-[0.3em] opacity-40"
            style={{ fontFamily: tokens.bodyFamily }}
          >
            @{tokens.name.toLowerCase().replace(/\s+/g, '')}
          </span>
        </div>
      </div>
    </div>
  );
};

// ── LinkedIn Post (1.91:1) ───────────────────────────────────────────────────
export const LinkedInPostMock: React.FC<MockProps> = ({ tokens, className }) => {
  const ct = pickColorTheme(tokens, 1);
  const { theme } = tokens;
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-2xl shadow-2xl', className)}
      style={{
        aspectRatio: '1.91 / 1',
        background: ct.bg,
        color: ct.text,
      }}
    >
      <div className="absolute inset-0 flex">
        <div
          className="w-1/3 flex flex-col justify-between p-[5%]"
          style={{ background: ct.primary, color: theme.accentText }}
        >
          <Logo tokens={tokens} size={28} />
          <div>
            <span
              className="block text-[9px] uppercase tracking-[0.3em] opacity-70 mb-1"
              style={{ fontFamily: tokens.bodyFamily }}
            >
              Insight
            </span>
            <span
              className="block text-[10px] opacity-90"
              style={{ fontFamily: tokens.bodyFamily }}
            >
              {smartTrunc(tokens.tagline, 35) || tokens.name}
            </span>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center p-[5%]">
          <span
            className="text-[9px] uppercase tracking-[0.4em] opacity-50 mb-2"
            style={{ fontFamily: tokens.bodyFamily, color: ct.accent }}
          >
            {tokens.name}
          </span>
          <h3
            className="font-bold leading-[1.05] tracking-tight"
            style={{
              fontFamily: tokens.headingFamily,
              fontSize: 'clamp(16px, 4cqi, 32px)',
              color: ct.text,
            }}
          >
            {smartTrunc(tokens.manifestoFirstLine, 60) ||
              smartTrunc(tokens.description, 60) ||
              `${tokens.name} — defining a new way to work.`}
          </h3>
          <p
            className="mt-3 opacity-60 leading-snug"
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 'clamp(9px, 1.8cqi, 13px)',
              color: ct.text,
            }}
          >
            {smartTrunc(tokens.description, 100) ||
              'Use this space for the body copy that supports your headline.'}
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Poster (3:4) ─────────────────────────────────────────────────────────────
export const PosterMock: React.FC<MockProps> = ({ tokens, className }) => {
  const ct = pickColorTheme(tokens, 0);
  const bgImage = pickMedia(tokens, 'background', 0) || pickMedia(tokens, 'stock', 0);
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-2xl shadow-2xl', className)}
      style={{
        aspectRatio: '3 / 4',
        background: ct.bg,
        color: ct.text,
      }}
    >
      {bgImage && (
        <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
      )}
      <div className="absolute inset-0 flex flex-col p-[7%]">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] uppercase tracking-[0.3em] opacity-60"
            style={{ fontFamily: tokens.bodyFamily }}
          >
            {tokens.name}
          </span>
          <span
            className="text-[10px] uppercase tracking-[0.3em] opacity-40"
            style={{ fontFamily: tokens.bodyFamily }}
          >
            {new Date().getFullYear()}
          </span>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center gap-6 text-center">
          <div className="opacity-90">
            <Logo tokens={tokens} size={64} />
          </div>
          <h1
            className="font-bold leading-[0.92] tracking-tighter max-w-[90%]"
            style={{
              fontFamily: tokens.headingFamily,
              fontSize: 'clamp(24px, 7cqi, 64px)',
              color: ct.text,
            }}
          >
            {smartTrunc(tokens.manifestoFirstLine, 30) || smartTrunc(tokens.tagline, 30) || tokens.name}
          </h1>
          <span
            className="block w-12 h-px"
            style={{ background: ct.accent }}
          />
          <p
            className="opacity-60 leading-relaxed max-w-[70%]"
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 'clamp(9px, 2cqi, 14px)',
              color: ct.text,
            }}
          >
            {smartTrunc(tokens.description, 90) || smartTrunc(tokens.tagline, 90)}
          </p>
        </div>

        <div className="flex items-end justify-between">
          <div className="flex items-center gap-1.5">
            {tokens.palette.slice(0, 5).map((c, i) => (
              <span
                key={i}
                className="w-4 h-1"
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <span
            className="text-[9px] uppercase tracking-[0.3em] opacity-40"
            style={{ fontFamily: tokens.bodyFamily }}
          >
            #poster
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Stories (9:16) ───────────────────────────────────────────────────────────
export const StoriesMock: React.FC<MockProps> = ({ tokens, className }) => {
  const ct = pickColorTheme(tokens, 1);
  const { theme } = tokens;
  const bgImage = pickMedia(tokens, 'background', 1) || pickMedia(tokens, 'stock', 1);
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-2xl shadow-2xl mx-auto', className)}
      style={{
        aspectRatio: '9 / 16',
        maxWidth: 360,
        background: ct.bg,
        color: ct.text,
      }}
    >
      {bgImage && (
        <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
      )}
      <div className="absolute inset-0 flex flex-col p-[6%]">
        <div className="flex items-center gap-1.5 mb-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="flex-1 h-0.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <span
                className="block h-full"
                style={{ background: ct.primary, width: i === 0 ? '60%' : '0%' }}
              />
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2.5 mb-auto">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: ct.bg, border: `1px solid ${ct.primary}` }}
          >
            {tokens.iconLogo ? (
              <img
                src={tokens.iconLogo.url}
                alt=""
                className="w-5 h-5 object-contain"
              />
            ) : (
              <span className="text-[10px] font-bold" style={{ color: ct.primary }}>
                {tokens.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span
            className="text-[11px] font-semibold"
            style={{ fontFamily: tokens.bodyFamily, color: ct.text }}
          >
            {tokens.name.toLowerCase()}
          </span>
        </div>

        <div
          className="absolute inset-0 m-auto flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <h2
            className="font-bold leading-[0.95] tracking-tight text-center px-[8%]"
            style={{
              fontFamily: tokens.headingFamily,
              fontSize: 'clamp(20px, 6cqi, 44px)',
              color: ct.text,
            }}
          >
            {smartTrunc(tokens.tagline, 40) || smartTrunc(tokens.manifestoFirstLine, 40) || tokens.name}
          </h2>
        </div>

        <div className="mt-auto flex flex-col items-center gap-3">
          <span
            className="px-4 py-2 rounded-full text-[10px] uppercase tracking-[0.3em] font-semibold"
            style={{
              background: ct.primary,
              color: theme.accentText,
              fontFamily: tokens.bodyFamily,
            }}
          >
            See more
          </span>
          <span
            className="text-[9px] uppercase tracking-[0.3em] opacity-40"
            style={{ fontFamily: tokens.bodyFamily }}
          >
            swipe up
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Website Hero (16:9) ─────────────────────────────────────────────────────
export const WebsiteHeroMock: React.FC<MockProps> = ({ tokens, className }) => {
  const ct = pickColorTheme(tokens, 0);
  const { theme } = tokens;
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-2xl shadow-2xl', className)}
      style={{ aspectRatio: '16 / 9', background: ct.bg, color: ct.text }}
    >
      <div className="absolute inset-0 flex flex-col">
        <div className="flex items-center justify-between px-[5%] py-[3%]">
          <Logo tokens={tokens} size={24} />
          <div className="flex items-center gap-4">
            {['About', 'Work', 'Contact'].map(l => (
              <span
                key={l}
                className="text-[9px] uppercase tracking-[0.2em] opacity-50"
                style={{ fontFamily: tokens.bodyFamily }}
              >
                {l}
              </span>
            ))}
            <span
              className="px-3 py-1 rounded-full text-[8px] uppercase tracking-[0.2em] font-semibold"
              style={{ background: ct.primary, color: theme.accentText, fontFamily: tokens.bodyFamily }}
            >
              Get Started
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-[7%] max-w-[65%]">
          <span
            className="text-[9px] uppercase tracking-[0.4em] opacity-50 mb-3"
            style={{ fontFamily: tokens.bodyFamily, color: ct.accent }}
          >
            {tokens.tagline || tokens.name}
          </span>
          <h1
            className="font-bold leading-[0.95] tracking-tight"
            style={{
              fontFamily: tokens.headingFamily,
              fontSize: 'clamp(18px, 4.5cqi, 40px)',
            }}
          >
            {smartTrunc(tokens.manifestoFirstLine, 45) || smartTrunc(tokens.description, 45) || `Welcome to ${tokens.name}`}
          </h1>
          <p
            className="mt-3 opacity-50 leading-relaxed max-w-[80%]"
            style={{ fontFamily: tokens.bodyFamily, fontSize: 'clamp(8px, 1.5cqi, 12px)' }}
          >
            {smartTrunc(tokens.description, 80) || 'Build something extraordinary with a brand that stands out.'}
          </p>
          <div className="flex gap-2 mt-4">
            <span
              className="px-4 py-1.5 rounded-lg text-[9px] uppercase tracking-[0.2em] font-semibold"
              style={{ background: ct.primary, color: theme.accentText, fontFamily: tokens.bodyFamily }}
            >
              Start now
            </span>
            <span
              className="px-4 py-1.5 rounded-lg text-[9px] uppercase tracking-[0.2em] font-semibold border"
              style={{ borderColor: `${ct.text}20`, fontFamily: tokens.bodyFamily }}
            >
              Learn more
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between px-[5%] py-[2%] border-t" style={{ borderColor: `${ct.text}10` }}>
          <div className="flex gap-1.5">
            {tokens.palette.slice(0, 5).map((c, i) => (
              <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c.hex }} />
            ))}
          </div>
          <span className="text-[8px] uppercase tracking-[0.3em] opacity-30" style={{ fontFamily: tokens.bodyFamily }}>
            {tokens.name} · {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Business Card (3.5:2) ───────────────────────────────────────────────────
export const BusinessCardMock: React.FC<MockProps> = ({ tokens, className }) => {
  const ct = pickColorTheme(tokens, 1);
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-xl shadow-2xl', className)}
      style={{ aspectRatio: '3.5 / 2', background: ct.bg, color: ct.text }}
    >
      <div className="absolute inset-0 flex">
        <div className="w-1.5 h-full" style={{ background: ct.primary }} />

        <div className="flex-1 flex flex-col justify-between p-[7%]">
          <div className="flex items-start justify-between">
            <Logo tokens={tokens} size={28} />
            <div className="flex gap-1">
              {tokens.palette.slice(0, 3).map((c, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: c.hex }} />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <h3
              className="font-bold tracking-tight"
              style={{ fontFamily: tokens.headingFamily, fontSize: 'clamp(14px, 3.5cqi, 22px)' }}
            >
              Jane Doe
            </h3>
            <p
              className="text-[9px] uppercase tracking-[0.3em] opacity-60"
              style={{ fontFamily: tokens.bodyFamily, color: ct.accent }}
            >
              Creative Director
            </p>
          </div>

          <div className="flex items-end justify-between">
            <div className="space-y-0.5">
              <p className="text-[8px] opacity-40" style={{ fontFamily: tokens.bodyFamily }}>
                hello@{tokens.name.toLowerCase().replace(/\s+/g, '')}.com
              </p>
              <p className="text-[8px] opacity-40" style={{ fontFamily: tokens.bodyFamily }}>
                +1 (555) 000-0000
              </p>
            </div>
            <span
              className="text-[8px] uppercase tracking-[0.2em] opacity-30 font-bold"
              style={{ fontFamily: tokens.bodyFamily }}
            >
              {tokens.name}
            </span>
          </div>
        </div>
      </div>
    </div>
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
                <img src={tokens.primaryLogo.url} alt="" className="w-[65%] h-[65%] object-contain" />
              ) : (
                <span
                  className="font-bold"
                  style={{ fontFamily: tokens.headingFamily, fontSize: 'clamp(14px, 3cqi, 28px)', color: ct.primary }}
                >
                  {tokens.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span
              className="px-4 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: ct.primary, color: theme.accentText, fontFamily: tokens.bodyFamily }}
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
              <svg viewBox="0 0 22 22" className="w-[1em] h-[1em]" style={{ fontSize: 'clamp(12px, 2.5cqi, 20px)' }}>
                <path d="M20.4 11l-1.4-1.6.2-2.1-2.1-.5-1-1.9-2 .7L11 4.2 7.9 5.6l-2-.7-1 1.9-2.1.5.2 2.1L1.6 11 3 12.6l-.2 2.1 2.1.5 1 1.9 2-.7 3.1 1.4 3.1-1.4 2 .7 1-1.9 2.1-.5-.2-2.1L20.4 11z" fill={ct.primary} />
                <path d="M9.7 14.8l-3-3 1.4-1.4 1.6 1.6 4.2-4.2 1.4 1.4-5.6 5.6z" fill={theme.accentText} />
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
            {smartTrunc(tokens.description, 80) || smartTrunc(tokens.tagline, 80) || `Assets by creatives → for creatives`}
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
                <span className="font-bold" style={{ fontFamily: tokens.headingFamily, fontSize: 'clamp(10px, 2cqi, 16px)', color: ct.primary }}>
                  {tokens.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-bold" style={{ fontFamily: tokens.bodyFamily, fontSize: 'clamp(9px, 1.8cqi, 14px)', color: ct.text }}>
                @{handle}
              </span>
              <span className="opacity-40" style={{ fontFamily: tokens.bodyFamily, fontSize: 'clamp(7px, 1.3cqi, 10px)', color: ct.text }}>
                Há 5 minutos
              </span>
            </div>
          </div>
          <span
            className="px-4 py-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider"
            style={{ background: ct.primary, color: theme.accentText, fontFamily: tokens.bodyFamily }}
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
        <div className="absolute inset-x-[12%] bottom-[18%] h-[38%] rounded-[20px] opacity-20" style={{ background: '#fff' }} />
        <div className="absolute inset-x-[8%] bottom-[22%] h-[38%] rounded-[22px] opacity-50" style={{ background: '#fff' }} />

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
              <span className="font-bold" style={{ fontFamily: tokens.headingFamily, fontSize: 'clamp(14px, 3cqi, 24px)', color: ct.primary }}>
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
              <span className="opacity-40 shrink-0 ml-2" style={{ fontFamily: tokens.bodyFamily, fontSize: 'clamp(8px, 1.4cqi, 12px)' }}>
                Há 1 min
              </span>
            </div>
            <p className="font-semibold mt-0.5" style={{ fontFamily: tokens.bodyFamily, fontSize: 'clamp(9px, 2cqi, 16px)' }}>
              {tokens.tagline ? smartTrunc(tokens.tagline, 25) : 'Mockup Alert'}
            </p>
            <p className="opacity-60 truncate" style={{ fontFamily: tokens.bodyFamily, fontSize: 'clamp(8px, 1.6cqi, 13px)' }}>
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
            <span className="font-bold" style={{ fontFamily: tokens.headingFamily, fontSize: 'clamp(20px, 5cqi, 40px)', color: ct.primary }}>
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
          style={{ fontFamily: tokens.bodyFamily, fontSize: 'clamp(9px, 2cqi, 14px)', color: ct.accent }}
        >
          {smartTrunc(tokens.tagline, 40) || 'Creative tools for everyone'}
        </p>

        <div className="flex-1" />

        <div
          className="w-full aspect-[9/14] rounded-xl overflow-hidden mb-[5%]"
          style={{ background: `${ct.primary}0A`, border: `1px solid ${ct.text}10` }}
        >
          {pickMedia(tokens, 'product') ? (
            <img src={pickMedia(tokens, 'product')!} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Logo tokens={tokens} size={48} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <svg key={i} viewBox="0 0 12 12" className="w-[10px] h-[10px]" style={{ fill: i <= 4 ? ct.primary : `${ct.text}20` }}>
                <path d="M6 0l1.8 3.7 4.2.6-3 2.9.7 4.1L6 9.5 2.3 11.3l.7-4.1-3-2.9 4.2-.6z" />
              </svg>
            ))}
            <span className="text-[8px] opacity-40 ml-1" style={{ fontFamily: tokens.bodyFamily }}>4.8</span>
          </div>
          <span
            className="px-3 py-1 rounded-full text-[8px] uppercase tracking-widest font-bold"
            style={{ background: ct.primary, color: theme.accentText, fontFamily: tokens.bodyFamily }}
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
        <div className="flex items-center justify-between px-[8%] py-[5%]" style={{ borderBottom: `2px solid ${ct.primary}` }}>
          <Logo tokens={tokens} size={28} mode="dark" />
          <div className="flex flex-col items-end">
            <span className="text-[7px] opacity-40" style={{ fontFamily: tokens.bodyFamily }}>
              hello@{tokens.name.toLowerCase().replace(/\s+/g, '')}.com
            </span>
            <span className="text-[7px] opacity-40" style={{ fontFamily: tokens.bodyFamily }}>
              {tokens.name.toLowerCase().replace(/\s+/g, '')}.com
            </span>
          </div>
        </div>

        {/* Body placeholder lines */}
        <div className="flex-1 px-[8%] py-[8%] flex flex-col gap-[3%]">
          <div className="h-[2px] w-[30%] rounded-full opacity-15" style={{ background: '#1a1a1a' }} />
          <div className="h-[2px] w-full rounded-full opacity-8" style={{ background: '#1a1a1a' }} />
          <div className="h-[2px] w-full rounded-full opacity-8" style={{ background: '#1a1a1a' }} />
          <div className="h-[2px] w-[85%] rounded-full opacity-8" style={{ background: '#1a1a1a' }} />
          <div className="h-[2px] w-full rounded-full opacity-8" style={{ background: '#1a1a1a' }} />
          <div className="h-[2px] w-[60%] rounded-full opacity-8" style={{ background: '#1a1a1a' }} />
          <div className="mt-auto" />
          <div className="h-[2px] w-[25%] rounded-full opacity-12" style={{ background: '#1a1a1a' }} />
          <div className="h-[2px] w-[20%] rounded-full opacity-10" style={{ background: '#1a1a1a' }} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-[8%] py-[3%]" style={{ borderTop: `1px solid ${ct.primary}33` }}>
          <div className="flex gap-1.5">
            {tokens.palette.slice(0, 4).map((c, i) => (
              <span key={i} className="w-2 h-2 rounded-full" style={{ background: c.hex }} />
            ))}
          </div>
          <span className="text-[7px] opacity-30 uppercase tracking-widest" style={{ fontFamily: tokens.bodyFamily }}>
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
            <span className="text-[8px] opacity-30 uppercase tracking-widest" style={{ fontFamily: tokens.bodyFamily }}>
              Brand Deck
            </span>
          </div>

          <div className="max-w-[90%]">
            <span
              className="text-[9px] uppercase tracking-[0.4em] opacity-50 block mb-2"
              style={{ fontFamily: tokens.bodyFamily, color: ct.accent }}
            >
              {tokens.tagline || 'Introduction'}
            </span>
            <h1
              className="font-bold leading-[0.92] tracking-tight"
              style={{ fontFamily: tokens.headingFamily, fontSize: 'clamp(18px, 4.5cqi, 40px)' }}
            >
              {smartTrunc(tokens.manifestoFirstLine, 35) || smartTrunc(tokens.description, 35) || `This is ${tokens.name}`}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {tokens.palette.slice(0, 5).map((c, i) => (
                <span key={i} className="w-6 h-1.5 rounded-sm" style={{ background: c.hex }} />
              ))}
            </div>
            <span className="text-[8px] opacity-30" style={{ fontFamily: tokens.bodyFamily }}>01</span>
          </div>
        </div>

        <div className="w-[38%] flex items-center justify-center relative" style={{ background: ct.primary }}>
          <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at 30% 50%, ${ct.bg}, transparent 70%)` }} />
          <div className="relative z-10 opacity-90">
            <Logo tokens={tokens} size={64} mode="auto" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Email Header (600:200 ~3:1) ─────────────────────────────────────────────
export const EmailHeaderMock: React.FC<MockProps> = ({ tokens, className }) => {
  const ct = pickColorTheme(tokens, 1);
  const { theme } = tokens;
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-xl shadow-2xl', className)}
      style={{ aspectRatio: '3 / 1', background: ct.bg, color: ct.text }}
    >
      <div className="absolute inset-0 flex items-center">
        <div
          className="h-full flex items-center justify-center px-[5%]"
          style={{ background: ct.primary, minWidth: '25%' }}
        >
          <Logo tokens={tokens} size={32} mode="auto" />
        </div>

        <div className="flex-1 flex flex-col justify-center px-[5%] gap-2">
          <h2
            className="font-bold leading-tight tracking-tight"
            style={{
              fontFamily: tokens.headingFamily,
              fontSize: 'clamp(14px, 3.5cqi, 24px)',
            }}
          >
            {tokens.tagline || `${tokens.name} Newsletter`}
          </h2>
          <p
            className="opacity-50 leading-relaxed"
            style={{ fontFamily: tokens.bodyFamily, fontSize: 'clamp(8px, 1.5cqi, 11px)' }}
          >
            {smartTrunc(tokens.description, 60) || 'Stay updated with the latest from our team.'}
          </p>
        </div>

        <div className="pr-[5%] flex flex-col items-end gap-1.5">
          <span
            className="px-3 py-1 rounded-md text-[8px] uppercase tracking-[0.2em] font-semibold"
            style={{ background: ct.primary, color: theme.accentText, fontFamily: tokens.bodyFamily }}
          >
            Read more
          </span>
          <span className="text-[7px] opacity-30" style={{ fontFamily: tokens.bodyFamily }}>
            Unsubscribe
          </span>
        </div>
      </div>
    </div>
  );
};
