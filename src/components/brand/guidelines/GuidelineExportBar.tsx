import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { FileText, FileJson, FileCode, Braces, Brain } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';
import { downloadBlob } from '@/components/brand/brand-shared-config';

interface GuidelineExportBarProps {
  guideline: BrandGuideline;
}

function guidelineToMarkdown(g: BrandGuideline): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push(`name: "${g.name || 'Untitled'}"`);
  if (g.description) lines.push(`description: "${g.description}"`);
  lines.push(`version: "${new Date().toISOString().split('T')[0]}"`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${g.name || 'Untitled'} Brand Guidelines`);
  lines.push('');

  // Identity
  lines.push('## Identity');
  if (g.tagline) lines.push(`- **Tagline:** ${g.tagline}`);
  if (g.identity?.website) lines.push(`- **Website:** ${g.identity.website}`);
  if (g.description) lines.push(`- **Description:** ${g.description}`);
  lines.push('');

  // Colors
  if (g.colors && g.colors.length > 0) {
    lines.push('## Colors');
    lines.push('');
    lines.push('| Name | Hex |');
    lines.push('|------|-----|');
    g.colors.forEach(c => lines.push(`| ${c.name} | \`${c.hex}\` |`));
    lines.push('');
  }

  // Typography
  if (g.typography && g.typography.length > 0) {
    lines.push('## Typography');
    lines.push('');
    lines.push('| Role | Family | Style | Size |');
    lines.push('|------|--------|-------|------|');
    g.typography.forEach(t => lines.push(`| ${t.role || '-'} | ${t.family} | ${t.style || 'Regular'} | ${t.size || '-'}px |`));
    lines.push('');
  }

  // Design Tokens
  if (g.tokens) {
    lines.push('## Design Tokens');
    lines.push('');
    if (g.tokens.spacing) {
      lines.push('### Spacing');
      Object.entries(g.tokens.spacing).forEach(([k, v]) => lines.push(`- **${k}:** ${v}`));
      lines.push('');
    }
    if (g.tokens.radius) {
      lines.push('### Radius');
      Object.entries(g.tokens.radius).forEach(([k, v]) => lines.push(`- **${k}:** ${v}`));
      lines.push('');
    }
  }

  // Tags / Strategy
  if (g.tags && Object.keys(g.tags).length > 0) {
    lines.push('## Strategy');
    lines.push('');
    Object.entries(g.tags).forEach(([cat, vals]) => {
      lines.push(`### ${cat}`);
      (vals as string[]).forEach(v => lines.push(`- ${v}`));
      lines.push('');
    });
  }

  // Editorial
  if (g.guidelines) {
    lines.push('## Editorial Guidelines');
    lines.push('');
    if (g.guidelines.voice) lines.push(`**Voice & Tone:** "${g.guidelines.voice}"`);
    lines.push('');
    if (g.guidelines.dos && g.guidelines.dos.length > 0) {
      lines.push("### Do's");
      g.guidelines.dos.forEach(d => lines.push(`- ${d}`));
      lines.push('');
    }
    if (g.guidelines.accessibility) {
      lines.push('### Accessibility');
      lines.push(g.guidelines.accessibility);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function guidelineToCSSVariables(g: BrandGuideline): string {
  const lines: string[] = [':root {'];

  // Colors
  g.colors?.forEach(c => {
    const name = (c.name || 'color').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    lines.push(`  --color-${name}: ${c.hex};`);
  });

  // Typography
  g.typography?.forEach(t => {
    const role = (t.role || 'font').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    lines.push(`  --font-${role}: '${t.family}', sans-serif;`);
  });

  // Spacing tokens
  if (g.tokens?.spacing) {
    Object.entries(g.tokens.spacing).forEach(([k, v]) => {
      if (v) lines.push(`  --spacing-${k}: ${v}px;`);
    });
  }

  // Radius tokens
  if (g.tokens?.radius) {
    Object.entries(g.tokens.radius).forEach(([k, v]) => {
      if (v) lines.push(`  --radius-${k}: ${v}px;`);
    });
  }

  lines.push('}');
  return lines.join('\n');
}

function guidelineToTailwindConfig(g: BrandGuideline): string {
  const colors: Record<string, string> = {};
  g.colors?.forEach(c => {
    const name = (c.name || 'color').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    colors[name] = c.hex;
  });

  const fontFamily: Record<string, string[]> = {};
  g.typography?.forEach(t => {
    const role = (t.role || 'sans').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    fontFamily[role] = [t.family, 'sans-serif'];
  });

  const spacing: Record<string, string> = {};
  if (g.tokens?.spacing) {
    Object.entries(g.tokens.spacing).forEach(([k, v]) => {
      if (v) spacing[k] = `${v}px`;
    });
  }

  const borderRadius: Record<string, string> = {};
  if (g.tokens?.radius) {
    Object.entries(g.tokens.radius).forEach(([k, v]) => {
      if (v) borderRadius[k] = `${v}px`;
    });
  }

  const extend: Record<string, unknown> = {};
  if (Object.keys(colors).length) extend.colors = colors;
  if (Object.keys(fontFamily).length) extend.fontFamily = fontFamily;
  if (Object.keys(spacing).length) extend.spacing = spacing;
  if (Object.keys(borderRadius).length) extend.borderRadius = borderRadius;

  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: ${JSON.stringify(extend, null, 6).replace(/"([^"]+)":/g, '$1:')}
  }
}`;
}

function guidelineToDesignMd(g: BrandGuideline): string {
  const lines: string[] = [];

  // YAML front matter
  lines.push('---');
  lines.push(`version: "${new Date().toISOString().split('T')[0]}"`);
  lines.push(`name: "${g.name || 'Untitled'}"`);
  if (g.description) lines.push(`description: "${g.description}"`);

  if (g.colors && g.colors.length > 0) {
    lines.push('colors:');
    g.colors.forEach(c => {
      const key = (c.name || 'color').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      lines.push(`  ${key}: "${c.hex}"`);
    });
  }

  if (g.typography && g.typography.length > 0) {
    lines.push('typography:');
    g.typography.forEach(t => {
      const key = (t.role || 'body').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      lines.push(`  ${key}:`);
      lines.push(`    fontFamily: "${t.family}"`);
      if (t.size) lines.push(`    fontSize: "${t.size}px"`);
      if (t.style) lines.push(`    fontWeight: "${t.style}"`);
      if (t.lineHeight) lines.push(`    lineHeight: ${t.lineHeight}`);
      if (t.letterSpacing) lines.push(`    letterSpacing: "${t.letterSpacing}"`);
    });
  }

  if (g.tokens?.radius) {
    lines.push('rounded:');
    Object.entries(g.tokens.radius).forEach(([k, v]) => lines.push(`  ${k}: "${v}px"`));
  }

  if (g.tokens?.spacing) {
    lines.push('spacing:');
    Object.entries(g.tokens.spacing).forEach(([k, v]) => lines.push(`  ${k}: "${v}px"`));
  }

  if (g.motion?.easing || g.motion?.durations) {
    lines.push('motion:');
    if (g.motion.easing) lines.push(`  easing: "${g.motion.easing}"`);
    if (g.motion.durations) {
      lines.push('  durations:');
      Object.entries(g.motion.durations).forEach(([k, v]) => lines.push(`    ${k}: "${v}ms"`));
    }
  }

  if (g.colorThemes?.length) {
    lines.push('colorThemes:');
    g.colorThemes.forEach(t => {
      const key = t.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      lines.push(`  ${key}:`);
      lines.push(`    bg: "${t.bg}"`);
      lines.push(`    text: "${t.text}"`);
      lines.push(`    primary: "${t.primary}"`);
      lines.push(`    accent: "${t.accent}"`);
    });
  }

  lines.push('---');
  lines.push('');
  lines.push(`# ${g.name || 'Untitled'}`);
  lines.push('');

  // Overview
  lines.push('## Overview');
  if (g.description) lines.push(g.description);
  if (g.tagline) lines.push('');
  if (g.tagline) lines.push(`> ${g.tagline}`);
  lines.push('');

  // Colors with semantic context
  if (g.colors && g.colors.length > 0) {
    lines.push('## Colors');
    lines.push('');
    g.colors.forEach(c => {
      const key = (c.name || 'color').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      lines.push(`\`${key}\` (\`${c.hex}\`) — ${c.role || 'Brand color'}.`);
    });
    lines.push('');
  }

  // Color Themes
  if (g.colorThemes && g.colorThemes.length > 0) {
    lines.push('## Color Themes');
    lines.push('');
    lines.push('Pre-defined color schemes for consistent application across surfaces:');
    lines.push('');
    g.colorThemes.forEach(t => {
      lines.push(`**${t.name}:** bg \`${t.bg}\`, text \`${t.text}\`, primary \`${t.primary}\`, accent \`${t.accent}\`.`);
    });
    lines.push('');
  }

  // Typography with intent
  if (g.typography && g.typography.length > 0) {
    lines.push('## Typography');
    lines.push('');
    g.typography.forEach(t => {
      lines.push(`**${t.role}:** ${t.family}${t.style ? ` ${t.style}` : ''}, ${t.size || 16}px${t.lineHeight ? `, line-height ${t.lineHeight}` : ''}${t.letterSpacing ? `, tracking ${t.letterSpacing}` : ''}.`);
    });
    lines.push('');
  }

  // Layout
  lines.push('## Layout');
  if (g.tokens?.spacing) {
    const entries = Object.entries(g.tokens.spacing);
    lines.push(`Spacing scale: ${entries.map(([k, v]) => `${k}=${v}px`).join(', ')}.`);
  }
  lines.push('');

  // Shapes
  if (g.tokens?.radius) {
    lines.push('## Shapes');
    const entries = Object.entries(g.tokens.radius);
    lines.push(`Corner radii: ${entries.map(([k, v]) => `${k}=${v}px`).join(', ')}.`);
    lines.push('');
  }

  // Elevation
  if (g.shadows && g.shadows.length > 0) {
    lines.push('## Elevation & Depth');
    lines.push('');
    g.shadows.forEach(s => {
      lines.push(`**${s.name}** (\`${s.type}\`): \`${s.css || ''}\``);
    });
    lines.push('');
  }

  // Motion
  if (g.motion) {
    lines.push('## Motion');
    if (g.motion.philosophy) lines.push(`Philosophy: ${g.motion.philosophy} — minimal, purposeful transitions.`);
    if (g.motion.respectsReducedMotion) lines.push('Always respect `prefers-reduced-motion`.');
    if (g.motion.easing) lines.push(`Default easing: \`${g.motion.easing}\`.`);
    lines.push('');
  }

  // Editorial / Voice
  if (g.guidelines?.voice || g.guidelines?.person) {
    lines.push("## Do's and Don'ts");
    lines.push('');
    if (g.guidelines.voice) lines.push(`Voice: "${g.guidelines.voice}"`);
    if (g.guidelines.person) lines.push(`Write in ${g.guidelines.person} person.`);
    if (g.guidelines.emojiPolicy === 'none') lines.push('Never use emoji in copy.');
    if (g.guidelines.casingRules && g.guidelines.casingRules.length > 0) {
      lines.push('');
      lines.push('**Casing:**');
      g.guidelines.casingRules.forEach(r => lines.push(`- ${r}`));
    }
    if (g.guidelines.dos && g.guidelines.dos.length > 0) {
      lines.push('');
      lines.push("**Do:**");
      g.guidelines.dos.forEach(d => lines.push(`- ${d}`));
    }
    lines.push('');
  }

  return lines.join('\n');
}

export const GuidelineExportBar: React.FC<GuidelineExportBarProps> = ({ guideline }) => {
  const { t } = useTranslation();
  const safeName = (guideline.identity?.name || guideline.name || 'brand').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  const exportJSON = () => {
    downloadBlob(JSON.stringify(guideline, null, 2), `${safeName}-guidelines.json`, 'application/json');
    toast.success('Exported as JSON');
  };

  const exportMarkdown = () => {
    downloadBlob(guidelineToMarkdown(guideline), `${safeName}-guidelines.md`, 'text/markdown');
    toast.success('Exported as Markdown');
  };

  const exportCSS = () => {
    downloadBlob(guidelineToCSSVariables(guideline), `${safeName}-variables.css`, 'text/css');
    toast.success('Exported as CSS Variables');
  };

  const exportTailwind = () => {
    downloadBlob(guidelineToTailwindConfig(guideline), `${safeName}.tailwind.config.js`, 'text/javascript');
    toast.success('Exported as Tailwind Config');
  };

  const exportDesignMd = () => {
    downloadBlob(guidelineToDesignMd(guideline), 'DESIGN.md', 'text/markdown');
    toast.success('Exported as DESIGN.md — LLM-ready spec');
  };

  const groupBtn =
    'h-8 px-3 text-[10px] font-mono text-neutral-500 hover:text-brand-cyan hover:bg-brand-cyan/5 gap-2';
  const groupLabel =
    'text-[9px] font-mono text-neutral-700 uppercase tracking-widest mr-1 shrink-0';
  const divider = 'h-4 w-px bg-white/[0.06] mx-1';

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-6 border-t border-white/[0.03]">
      <span className="text-[10px] font-mono text-neutral-700 uppercase tracking-widest mr-2">
        Export
      </span>

      {/* Devs */}
      <span className={groupLabel}>Devs</span>
      <Button variant="ghost" size="sm" onClick={exportJSON} className={groupBtn}>
        <FileJson size={12} /> JSON
      </Button>
      <Button variant="ghost" size="sm" onClick={exportCSS} className={groupBtn}>
        <FileCode size={12} /> CSS
      </Button>
      <Button variant="ghost" size="sm" onClick={exportTailwind} className={groupBtn}>
        <Braces size={12} /> Tailwind
      </Button>

      <span className={divider} aria-hidden />

      {/* Docs */}
      <span className={groupLabel}>Docs</span>
      <Button variant="ghost" size="sm" onClick={exportMarkdown} className={groupBtn}>
        <FileText size={12} /> Markdown
      </Button>

      <span className={divider} aria-hidden />

      {/* Para IA */}
      <span className={cn(groupLabel, 'text-brand-cyan/60')}>Para IA</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={exportDesignMd}
        className="h-8 px-3 text-[10px] font-mono gap-2 text-brand-cyan/90 hover:text-brand-cyan bg-brand-cyan/[0.04] hover:bg-brand-cyan/[0.08] border border-brand-cyan/20 hover:border-brand-cyan/40 transition-all"
        title="LLM-ready spec — copia direto pra prompts ou IDE assistants"
      >
        <Brain size={12} />
        DESIGN.md
      </Button>
    </div>
  );
};
