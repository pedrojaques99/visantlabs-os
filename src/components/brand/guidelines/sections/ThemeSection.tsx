import React, { useState, useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SwatchBook, Plus, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { BrandGuideline, BrandColorTheme } from '@/lib/figma-types';
import { getContrastRatioPublic, checkWCAGCompliance } from '@/utils/colorUtils';

interface ThemeSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

const ROLES = ['bg', 'text', 'primary', 'accent'] as const;
const ROLE_LABELS: Record<string, string> = {
  bg: 'Background',
  text: 'Text',
  primary: 'Primary',
  accent: 'Accent',
};

function ContrastBadge({ fg, bg, label }: { fg: string; bg: string; label: string }) {
  const ratio = getContrastRatioPublic(fg, bg);
  const { normalAA } = checkWCAGCompliance(ratio);
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider ${
        normalAA ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
      }`}
      title={`${label}: ${ratio.toFixed(1)}:1 — ${normalAA ? 'WCAG AA ✓' : 'Low contrast'}`}
    >
      {label} {ratio.toFixed(1)}:1
      {normalAA && <Check size={8} />}
    </span>
  );
}

function ThemePreview({ theme }: { theme: BrandColorTheme }) {
  return (
    <div
      className="rounded-lg overflow-hidden border border-white/5 shadow-lg"
      style={{ background: theme.bg }}
    >
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: theme.primary }} />
          <span className="text-[10px] font-mono uppercase tracking-widest opacity-60" style={{ color: theme.text }}>
            {theme.name || 'Theme'}
          </span>
        </div>
        <h3 className="text-sm font-bold tracking-tight" style={{ color: theme.text, fontFamily: 'inherit' }}>
          Preview headline
        </h3>
        <p className="text-[11px] opacity-70" style={{ color: theme.text }}>
          Body text preview for contrast.
        </p>
        <div className="flex gap-2 pt-1">
          <span
            className="px-3 py-1 rounded-md text-[10px] font-semibold"
            style={{ background: theme.primary, color: theme.bg }}
          >
            Primary
          </span>
          <span
            className="px-3 py-1 rounded-md text-[10px] font-semibold"
            style={{ background: theme.accent, color: theme.bg }}
          >
            Accent
          </span>
        </div>
      </div>
    </div>
  );
}

export const ThemeSection: React.FC<ThemeSectionProps> = ({ guideline, onUpdate, span }) => {
  const themes = guideline.colorThemes || [];
  const brandColors = guideline.colors || [];
  const [editingId, setEditingId] = useState<string | null>(null);

  const persist = useCallback(
    (next: BrandColorTheme[]) => onUpdate({ colorThemes: next }),
    [onUpdate]
  );

  const addTheme = () => {
    const defaultBg = brandColors.find(c => c.role?.toLowerCase().includes('bg') || c.name?.toLowerCase().includes('bg'))?.hex || '#1A1A1A';
    const defaultText = brandColors.find(c => c.role?.toLowerCase().includes('text'))?.hex || '#FFFFFF';
    const defaultPrimary = brandColors[0]?.hex || '#888888';
    const defaultAccent = brandColors[1]?.hex || brandColors[0]?.hex || '#FF6B00';

    const newTheme: BrandColorTheme = {
      id: crypto.randomUUID(),
      name: `Theme ${themes.length + 1}`,
      bg: defaultBg,
      text: defaultText,
      primary: defaultPrimary,
      accent: defaultAccent,
    };
    persist([...themes, newTheme]);
    setEditingId(newTheme.id);
    toast.success('Theme added');
  };

  const updateTheme = (id: string, patch: Partial<BrandColorTheme>) => {
    persist(themes.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const removeTheme = (id: string) => {
    persist(themes.filter(t => t.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const colorOptions = brandColors.map(c => ({
    hex: c.hex,
    label: c.name || c.role || c.hex,
  }));

  return (
    <SectionBlock
      id="colorThemes"
      span={span as any}
      icon={<SwatchBook size={14} />}
      title="Color Themes"
      actions={
        <Button
          size="sm"
          variant="ghost"
          onClick={addTheme}
          className="h-6 px-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-white"
        >
          <Plus size={10} className="mr-1" /> Add
        </Button>
      }
    >
      {themes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <SwatchBook size={20} className="text-neutral-700" />
          <p className="text-[10px] text-neutral-600 max-w-[280px] leading-relaxed">
            Define combinações de cores (fundo, texto, primary, accent) para garantir contraste
            e harmonia nos criativos gerados pela IA.
          </p>
          <Button size="sm" variant="outline" onClick={addTheme} className="mt-2 h-7 text-[10px]">
            <Plus size={10} className="mr-1" /> Create first theme
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {themes.map(theme => {
              const isEditing = editingId === theme.id;
              return (
                <motion.div
                  key={theme.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="border border-white/[0.06] rounded-xl overflow-hidden bg-neutral-950/40"
                >
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04]">
                    <div className="flex gap-1">
                      {ROLES.map(r => (
                        <span
                          key={r}
                          className="w-4 h-4 rounded-sm border border-white/10"
                          style={{ background: theme[r] }}
                          title={`${ROLE_LABELS[r]}: ${theme[r]}`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : theme.id)}
                      className="flex-1 text-left text-[11px] font-medium text-neutral-300 hover:text-white transition-colors truncate"
                    >
                      {theme.name}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <ContrastBadge fg={theme.text} bg={theme.bg} label="txt" />
                      <ContrastBadge fg={theme.primary} bg={theme.bg} label="pri" />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeTheme(theme.id)}
                        className="w-6 h-6 text-neutral-600 hover:text-red-400"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>

                  {isEditing && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-4 p-4">
                        <div className="space-y-3">
                          <Input
                            value={theme.name}
                            onChange={e => updateTheme(theme.id, { name: e.target.value })}
                            placeholder="Theme name"
                            className="h-7 text-xs bg-transparent border-white/10"
                          />
                          {ROLES.map(role => (
                            <div key={role} className="flex items-center gap-2">
                              <label className="text-[9px] font-mono uppercase tracking-widest text-neutral-600 w-16 shrink-0">
                                {ROLE_LABELS[role]}
                              </label>
                              <div className="flex items-center gap-1.5 flex-1">
                                <input
                                  type="color"
                                  value={theme[role]}
                                  onChange={e => updateTheme(theme.id, { [role]: e.target.value })}
                                  className="w-6 h-6 rounded cursor-pointer border border-white/10 bg-transparent [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch-wrapper]:p-0"
                                />
                                <Input
                                  value={theme[role]}
                                  onChange={e => updateTheme(theme.id, { [role]: e.target.value })}
                                  className="h-6 text-[10px] font-mono bg-transparent border-white/10 flex-1"
                                />
                              </div>
                              {colorOptions.length > 0 && (
                                <div className="flex gap-0.5">
                                  {colorOptions.slice(0, 6).map(c => (
                                    <button
                                      key={c.hex}
                                      type="button"
                                      onClick={() => updateTheme(theme.id, { [role]: c.hex })}
                                      className={`w-4 h-4 rounded-sm border transition-all ${
                                        theme[role].toLowerCase() === c.hex.toLowerCase()
                                          ? 'border-white scale-110'
                                          : 'border-white/10 hover:border-white/30'
                                      }`}
                                      style={{ background: c.hex }}
                                      title={c.label}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <ThemePreview theme={theme} />
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </SectionBlock>
  );
};
