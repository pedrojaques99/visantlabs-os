import React from 'react';
import { cn } from '@/lib/utils';
import type { MockTokens } from './mockTokens';

interface MockProps {
  tokens: MockTokens;
  className?: string;
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
        alt={tokens.name}
        style={{ height: size, width: 'auto', objectFit: 'contain', maxWidth: size * 4 }}
      />
    );
  }
  return (
    <span
      className="font-bold tracking-tight"
      style={{ fontFamily: tokens.headingFamily, fontSize: size * 0.72 }}
    >
      {tokens.name}
    </span>
  );
};

// ── Instagram Feed (1:1) ─────────────────────────────────────────────────────
export const InstagramFeedMock: React.FC<MockProps> = ({ tokens, className }) => {
  const { theme } = tokens;
  return (
    <div
      className={cn('relative aspect-square w-full overflow-hidden rounded-2xl shadow-2xl', className)}
      style={{ background: theme.bg, color: theme.text }}
    >
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
            style={{ fontFamily: tokens.bodyFamily, color: theme.accent }}
          >
            {tokens.tagline || 'New chapter'}
          </span>
          <h2
            className="font-bold leading-[0.95] tracking-tight"
            style={{
              fontFamily: tokens.headingFamily,
              fontSize: 'clamp(28px, 6vw, 56px)',
              color: theme.text,
            }}
          >
            {tokens.manifestoFirstLine?.slice(0, 80) ||
              tokens.description?.slice(0, 80) ||
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
  const { theme } = tokens;
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-2xl shadow-2xl', className)}
      style={{
        aspectRatio: '1.91 / 1',
        background: theme.surface,
        color: theme.text,
      }}
    >
      <div className="absolute inset-0 flex">
        <div
          className="w-1/3 flex flex-col justify-between p-[5%]"
          style={{ background: theme.accent, color: theme.accentText }}
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
              {tokens.tagline?.slice(0, 40) || tokens.name}
            </span>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center p-[5%]">
          <span
            className="text-[9px] uppercase tracking-[0.4em] opacity-50 mb-2"
            style={{ fontFamily: tokens.bodyFamily, color: theme.accent }}
          >
            {tokens.name}
          </span>
          <h3
            className="font-bold leading-[1.05] tracking-tight"
            style={{
              fontFamily: tokens.headingFamily,
              fontSize: 'clamp(20px, 3.5vw, 36px)',
              color: theme.text,
            }}
          >
            {tokens.manifestoFirstLine?.slice(0, 90) ||
              tokens.description?.slice(0, 90) ||
              `${tokens.name} — defining a new way to work.`}
          </h3>
          <p
            className="mt-3 opacity-60 leading-snug"
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 'clamp(10px, 1.4vw, 14px)',
              color: theme.text,
            }}
          >
            {tokens.description?.slice(0, 140) ||
              'Use this space for the body copy that supports your headline.'}
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Poster (3:4) ─────────────────────────────────────────────────────────────
export const PosterMock: React.FC<MockProps> = ({ tokens, className }) => {
  const { theme } = tokens;
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-2xl shadow-2xl', className)}
      style={{
        aspectRatio: '3 / 4',
        background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.surface} 100%)`,
        color: theme.text,
      }}
    >
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
              fontSize: 'clamp(36px, 8vw, 88px)',
              color: theme.text,
            }}
          >
            {tokens.manifestoFirstLine?.slice(0, 40) || tokens.tagline || tokens.name}
          </h1>
          <span
            className="block w-12 h-px"
            style={{ background: theme.accent }}
          />
          <p
            className="opacity-60 leading-relaxed max-w-[70%]"
            style={{
              fontFamily: tokens.bodyFamily,
              fontSize: 'clamp(11px, 1.6vw, 16px)',
              color: theme.text,
            }}
          >
            {tokens.description?.slice(0, 130) || tokens.tagline}
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
  const { theme } = tokens;
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-2xl shadow-2xl mx-auto', className)}
      style={{
        aspectRatio: '9 / 16',
        maxWidth: 360,
        background: theme.bg,
        color: theme.text,
      }}
    >
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
                style={{ background: theme.accent, width: i === 0 ? '60%' : '0%' }}
              />
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2.5 mb-auto">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: theme.surface, border: `1px solid ${theme.accent}` }}
          >
            {tokens.iconLogo ? (
              <img
                src={tokens.iconLogo.url}
                alt=""
                className="w-5 h-5 object-contain"
              />
            ) : (
              <span className="text-[10px] font-bold" style={{ color: theme.accent }}>
                {tokens.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span
            className="text-[11px] font-semibold"
            style={{ fontFamily: tokens.bodyFamily, color: theme.text }}
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
              fontSize: 'clamp(28px, 8vw, 56px)',
              color: theme.text,
            }}
          >
            {tokens.tagline || tokens.manifestoFirstLine?.slice(0, 60) || tokens.name}
          </h2>
        </div>

        <div className="mt-auto flex flex-col items-center gap-3">
          <span
            className="px-4 py-2 rounded-full text-[10px] uppercase tracking-[0.3em] font-semibold"
            style={{
              background: theme.accent,
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
