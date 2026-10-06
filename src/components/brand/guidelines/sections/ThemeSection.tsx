import React, { useState, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SwatchBook, Plus, Trash2, Check } from '@/lib/ui/icons';
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
  bg: 'brandEditor.roleBg',
  text: 'brandEditor.roleText',
  primary: 'brandEditor.rolePrimary',
  accent: 'brandEditor.roleAccent',
};

function ContrastBadge({ fg, bg, label }: { fg: string; bg: string; label: string }) {
  const { t } = useTranslation();
  const ratio = getContrastRatioPublic(fg, bg);
  const { normalAA } = checkWCAGCompliance(ratio);
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs tabular-nums ${
        normalAA ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
      }`}
      title={`${label}: ${ratio.toFixed(1)}:1, ${normalAA ? 'WCAG AA' : t('brandEditor.lowContrast')}`}
    >
      {label} {ratio.toFixed(1)}:1
      {normalAA && <Check size={8} />}
    </span>
  );
}

function ThemePreview({ theme }: { theme: BrandColorTheme }) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-xl overflow-hidden border border-border shadow-lg"
      style={{ background: theme.bg }}
    >
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: theme.primary }} />
          <span className="text-2xs opacity-60" style={{ color: theme.text }}>
            {theme.name || t('brandEditor.themeFallback')}
          </span>
        </div>
        <h3
          className="text-sm font-bold tracking-tight"
          style={{ color: theme.text, fontFamily: 'inherit' }}
        >
          {t('brandEditor.previewHeadline')}
        </h3>
        <p className="text-2xs opacity-70" style={{ color: theme.text }}>
          {t('brandEditor.previewBody')}
        </p>
        <div className="flex gap-2 pt-1">
          <span
            className="px-3 py-1 rounded-md text-2xs font-semibold"
            style={{ background: theme.primary, color: theme.bg }}
          >
            {t('brandEditor.rolePrimary')}
          </span>
          <span
            className="px-3 py-1 rounded-md text-2xs font-semibold"
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
  const { t } = useTranslation();
  const themes = guideline.colorThemes || [];
  const brandColors = guideline.colors || [];
  const [editingId, setEditingId] = useState<string | null>(null);

  const persist = useCallback(
    (next: BrandColorTheme[]) => onUpdate({ colorThemes: next }),
    [onUpdate]
  );

  const addTheme = () => {
    const defaultBg =
      brandColors.find(
        (c) => c.role?.toLowerCase().includes('bg') || c.name?.toLowerCase().includes('bg')
      )?.hex || '#1A1A1A';
    const defaultText =
      brandColors.find((c) => c.role?.toLowerCase().includes('text'))?.hex || '#FFFFFF';
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
    toast.success(t('brandEditor.themeAdded'));
  };

  const updateTheme = (id: string, patch: Partial<BrandColorTheme>) => {
    persist(themes.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const removeTheme = (id: string) => {
    persist(themes.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const colorOptions = brandColors.map((c) => ({
    hex: c.hex,
    label: c.name || c.role || c.hex,
  }));

  return (
    <SectionBlock
      id="colorThemes"
      span={span as any}
      icon={<SwatchBook size={14} />}
      title={t('brandEditor.colorThemes')}
      actions={
        <Button
          size="sm"
          variant="ghost"
          onClick={addTheme}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          aria-label={t('brandEditor.newTheme')}
          title={t('brandEditor.newTheme')}
        >
          <Plus size={12} />
        </Button>
      }
    >
      {themes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <SwatchBook size={20} className="text-muted-foreground/50" />
          <p className="text-2xs text-muted-foreground/70 max-w-[280px] leading-relaxed">
            {t('brandEditor.themesHint')}
          </p>
          <Button size="sm" variant="outline" onClick={addTheme} className="mt-2 h-7 text-2xs">
            <Plus size={10} className="mr-1" /> {t('brandEditor.createFirstTheme')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {themes.map((theme) => {
              const isEditing = editingId === theme.id;
              return (
                <motion.div
                  key={theme.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="border border-border rounded-xl overflow-hidden bg-background/40"
                >
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
                    <div className="flex gap-1">
                      {ROLES.map((r) => (
                        <span
                          key={r}
                          className="w-4 h-4 rounded-md border border-border"
                          style={{ background: theme[r] }}
                          title={`${t(ROLE_LABELS[r])}: ${theme[r]}`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : theme.id)}
                      className="flex-1 text-left text-2xs font-medium text-foreground hover:text-foreground transition-colors truncate"
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
                        className="w-6 h-6 text-muted-foreground/70 hover:text-destructive"
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
                            onChange={(e) => updateTheme(theme.id, { name: e.target.value })}
                            placeholder={t('brandEditor.themeName')}
                            className="h-7 text-xs bg-transparent border-border"
                          />
                          {ROLES.map((role) => (
                            <div key={role} className="flex items-center gap-2">
                              <label className="text-2xs text-muted-foreground w-16 shrink-0">
                                {t(ROLE_LABELS[role])}
                              </label>
                              <div className="flex items-center gap-1.5 flex-1">
                                <input
                                  type="color"
                                  value={theme[role]}
                                  onChange={(e) =>
                                    updateTheme(theme.id, { [role]: e.target.value })
                                  }
                                  className="w-6 h-6 rounded cursor-pointer border border-border bg-transparent [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch-wrapper]:p-0"
                                />
                                <Input
                                  value={theme[role]}
                                  onChange={(e) =>
                                    updateTheme(theme.id, { [role]: e.target.value })
                                  }
                                  className="h-6 text-2xs font-mono bg-transparent border-border flex-1"
                                />
                              </div>
                              {colorOptions.length > 0 && (
                                <div className="flex gap-0.5">
                                  {colorOptions.slice(0, 6).map((c) => (
                                    <button
                                      key={c.hex}
                                      type="button"
                                      onClick={() => updateTheme(theme.id, { [role]: c.hex })}
                                      className={`w-4 h-4 rounded-md border transition-colors ${
                                        theme[role].toLowerCase() === c.hex.toLowerCase()
                                          ? 'border-foreground ring-1 ring-foreground'
                                          : 'border-border hover:border-ring'
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
