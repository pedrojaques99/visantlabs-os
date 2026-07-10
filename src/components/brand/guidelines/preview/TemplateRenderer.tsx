/**
 * TemplateRenderer — renders a Figma `[Template]` frame as live DOM, from a schema.
 *
 * The sync bridge: a parser reads a Figma frame into a normalized layout schema
 * (geometry as a transform matrix + which `Brand` variable each fill binds to + which
 * slot each text is). This component interprets that schema, resolving variables →
 * the brand's `roleTheme` and slots → content. So editing the Figma frame (re-parse)
 * reflects here with ZERO hand-written React per template — one source, two renderers.
 *
 * POC: schema is a static JSON. Production: the Visant plugin pushes it on "sync".
 */
import React, { useMemo } from 'react';
import { Artboard } from './Artboard';
import { FitText } from './FitText';
import { buildRoleTheme, type MockTokens, type RoleTheme } from './mockTokens';
import { resolveContent, splitTwo, type MockOverrides } from './BrandMocks';
import { useGoogleFonts } from './useBrandFonts';
import {
  collectFontFamilies,
  type TemplateSchema,
  type TemplateNode,
} from '@/lib/figma-template-schema';
import {
  resolveFill,
  resolveSlot,
  contrastNeutral,
  WEIGHTS,
  type TemplateContent,
} from './templateResolve';

export type { TemplateSchema } from '@/lib/figma-template-schema';

// ── Node renderer ────────────────────────────────────────────────────────────

function renderNode(
  node: TemplateNode,
  t: RoleTheme,
  tokens: MockTokens,
  c: TemplateContent,
  key: string,
  autoTokenize: boolean,
  bg: string
): React.ReactNode {
  const [a, b, cc, d, e, f] = node.m;
  const pos: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    transform: `matrix(${a},${b},${cc},${d},${e},${f})`,
    transformOrigin: '0 0',
    opacity: node.opacity,
  };
  const strokeColor = node.stroke
    ? resolveFill(
        { varName: node.stroke.varName, hex: node.stroke.hex, opacity: node.stroke.opacity },
        t,
        autoTokenize
      )
    : undefined;

  // A LINE (a divider) has height 0 — its STROKE is the visible mark. Render as a rule.
  if (node.type === 'LINE') {
    return (
      <div
        key={key}
        style={{
          ...pos,
          width: node.w || 1,
          height: Math.max(1, node.stroke?.weight ?? 1),
          background: strokeColor,
        }}
      />
    );
  }

  if (node.type === 'TEXT' && node.text) {
    // Required slots fall back to the layer's literal text (never blank); optional
    // slots ('#name?') pass no fallback, so they hide when the brand has no content.
    const literal = node.text.chars;
    const txt = node.slot
      ? resolveSlot(node.slot.id, c, node.slot.optional ? '' : literal)
      : literal;
    if (node.slot?.optional && !txt) return null;
    const family =
      node.text.fontVar === 'heading-font'
        ? tokens.headingFamily
        : node.text.fontVar === 'body-font'
          ? tokens.bodyFamily
          : `'${node.text.family}'`;
    const letter = node.text.letter
      ? node.text.letter.unit === 'PIXELS'
        ? node.text.letter.value
        : (node.text.letter.value / 100) * node.text.size
      : undefined;
    const lineHeight = node.text.lhPct ? node.text.lhPct / 100 : 1;
    const typeStyle: React.CSSProperties = {
      ...pos,
      fontFamily: family,
      fontWeight: node.text.style ? WEIGHTS[node.text.style] || 400 : 400,
      color: autoTokenize ? contrastNeutral(bg, t) : resolveFill(node.fill, t),
      textAlign: (node.text.align?.toLowerCase() as React.CSSProperties['textAlign']) || undefined,
      textTransform:
        node.text.tcase === 'UPPER'
          ? 'uppercase'
          : node.text.tcase === 'LOWER'
            ? 'lowercase'
            : undefined,
      letterSpacing: letter,
    };

    // Slot text varies in length per brand → fit to the node's box so it never
    // overflows or clips mid-word. Literal (authored) text keeps its exact size.
    if (node.slot) {
      return (
        <FitText
          key={key}
          maxFontSize={node.text.size}
          minFontSize={Math.max(12, Math.round(node.text.size * 0.4))}
          maxWidth={node.w}
          maxHeight={node.h}
          lineHeight={lineHeight}
          style={typeStyle}
        >
          {txt}
        </FitText>
      );
    }
    return (
      <div
        key={key}
        style={{ ...typeStyle, width: node.w, height: node.h, fontSize: node.text.size, lineHeight, whiteSpace: 'pre-wrap' }}
      >
        {txt}
      </div>
    );
  }

  const nodeBg = resolveFill(node.fill, t, autoTokenize);
  const childBg = nodeBg || bg; // children inherit this node's bg for text contrast
  return (
    <div
      key={key}
      style={{
        ...pos,
        width: node.w,
        height: node.h,
        background: nodeBg,
        border: node.stroke && strokeColor ? `${node.stroke.weight}px solid ${strokeColor}` : undefined,
        borderRadius: node.type === 'ELLIPSE' ? '50%' : node.cornerRadius,
        overflow: node.clip ? 'hidden' : undefined,
      }}
    >
      {node.children?.map((ch, i) =>
        renderNode(ch, t, tokens, c, `${key}-${i}`, autoTokenize, childBg)
      )}
    </div>
  );
}

// ── Public component ─────────────────────────────────────────────────────────

export const TemplateRenderer: React.FC<{
  schema: TemplateSchema;
  tokens: MockTokens;
  variant?: number;
  overrides?: MockOverrides;
  className?: string;
  exportRef?: React.Ref<HTMLDivElement>;
  /** Snap literal (non-variable) colors to the nearest brand role — for imported raw frames. */
  autoTokenize?: boolean;
}> = ({ schema, tokens, variant = 0, overrides, className, exportRef, autoTokenize = false }) => {
  // Load whatever fonts the frame uses (Red Hat Mono, Almarai…) so it renders in real type.
  useGoogleFonts(useMemo(() => collectFontFamilies(schema), [schema]));
  const t = buildRoleTheme(tokens, variant);
  const rc = resolveContent(tokens, overrides);
  const [tagL, tagR] = splitTwo(rc.tagline || rc.name);
  const c: TemplateContent = {
    name: rc.name,
    headline: rc.headline,
    body: rc.body,
    caption: rc.tagline || rc.body,
    tagL,
    tagR,
    keywords: tokens.keywords,
    tagline: rc.tagline || '',
    description: tokens.description || '',
  };
  const root = schema.root;
  const rootBg = resolveFill(root.fill, t, autoTokenize) || t.bg;
  return (
    <Artboard w={schema.width} h={schema.height} className={className} exportRef={exportRef}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: rootBg,
          borderRadius: root.cornerRadius,
          overflow: root.clip ? 'hidden' : undefined,
        }}
      >
        {root.children?.map((ch, i) => renderNode(ch, t, tokens, c, `n${i}`, autoTokenize, rootBg))}
      </div>
    </Artboard>
  );
};
