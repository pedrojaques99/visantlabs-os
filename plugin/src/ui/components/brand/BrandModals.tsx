import React, { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface SmartScanItem {
  id: string;
  name: string;
  type: string;
  category?: 'logo' | 'font' | 'color' | 'component' | 'skip';
  thumbnail?: string;
  metadata?: Record<string, any>;
}

interface SmartScanModalProps {
  isOpen: boolean;
  items: SmartScanItem[];
  onApply: (categorized: SmartScanItem[]) => void;
  onClose: () => void;
}

function sanitizeThumbnailUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function SmartScanModal({ isOpen, items, onApply, onClose }: SmartScanModalProps) {
  const { t } = useTranslation();
  const [categorized, setCategorized] = useState<SmartScanItem[]>(items);

  const handleCategoryChange = (id: string, category: string) => {
    setCategorized(
      categorized.map((item) => (item.id === id ? { ...item, category: category as any } : item))
    );
  };

  const handleApply = () => {
    onApply(categorized);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {t('plugin.brand.modals.smartScanTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            {t('plugin.brand.modals.smartScanDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {categorized.map((item) => (
            <div key={item.id} className="border border-border rounded p-2 space-y-2">
              <div className="flex items-center gap-2">
                {item.thumbnail &&
                  (() => {
                    const safeUrl = sanitizeThumbnailUrl(item.thumbnail!);
                    return safeUrl ? (
                      <img src={safeUrl} alt={item.name} className="w-8 h-8 rounded" />
                    ) : null;
                  })()}
                <div className="flex-1">
                  <p className="text-xs font-mono font-semibold">{item.name}</p>
                  {item.metadata && (
                    <p className="text-[10px] text-muted-foreground">
                      {JSON.stringify(item.metadata)}
                    </p>
                  )}
                </div>
              </div>

              <Select
                options={[
                  { value: 'logo', label: t('plugin.brand.modals.catLogo') },
                  { value: 'font', label: t('plugin.brand.modals.catFont') },
                  { value: 'color', label: t('plugin.brand.modals.catColor') },
                  { value: 'component', label: t('plugin.brand.modals.catComponent') },
                  { value: 'skip', label: t('plugin.brand.modals.catSkip') },
                ]}
                value={item.category || 'skip'}
                onChange={(value) => handleCategoryChange(item.id, value as string)}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleApply}
            className="flex-1 bg-brand-cyan text-black hover:bg-brand-cyan/90 text-xs h-8"
          >
            {t('plugin.brand.modals.apply')}
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1 text-xs h-8">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PushPreviewModalProps {
  isOpen: boolean;
  changes: {
    colors?: any[];
    typography?: any[];
    logos?: any[];
    tokens?: any;
  };
  onPush: (selectedChanges: string[]) => void;
  onClose: () => void;
}

export function PushPreviewModal({ isOpen, changes, onPush, onClose }: PushPreviewModalProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>(['colors', 'typography', 'logos', 'tokens']);

  const handleToggle = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handlePush = () => {
    onPush(selected);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {t('plugin.brand.modals.pushTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            {t('plugin.brand.modals.pushDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {changes.colors && changes.colors.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={selected.includes('colors')}
                onCheckedChange={() => handleToggle('colors')}
              />
              <span className="text-xs">
                {t('plugin.brand.modals.colorsNew')}{' '}
                <span className="text-muted-foreground">
                  ({t('plugin.brand.modals.countNew', { count: changes.colors.length })})
                </span>
              </span>
            </label>
          )}

          {changes.typography && changes.typography.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={selected.includes('typography')}
                onCheckedChange={() => handleToggle('typography')}
              />
              <span className="text-xs">
                Typography{' '}
                <span className="text-muted-foreground">({changes.typography.length} new)</span>
              </span>
            </label>
          )}

          {changes.logos && changes.logos.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={selected.includes('logos')}
                onCheckedChange={() => handleToggle('logos')}
              />
              <span className="text-xs">
                {t('plugin.brand.modals.logosNew')}{' '}
                <span className="text-muted-foreground">
                  ({t('plugin.brand.modals.countNew', { count: changes.logos.length })})
                </span>
              </span>
            </label>
          )}

          {changes.tokens && Object.keys(changes.tokens).length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={selected.includes('tokens')}
                onCheckedChange={() => handleToggle('tokens')}
              />
              <span className="text-xs">
                Design Tokens{' '}
                <span className="text-muted-foreground">
                  ({Object.keys(changes.tokens).length} new)
                </span>
              </span>
            </label>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handlePush}
            disabled={selected.length === 0}
            className="flex-1 bg-brand-cyan text-black hover:bg-brand-cyan/90 text-xs h-8"
          >
            {t('plugin.brand.modals.push')}
          </Button>
          <Button onClick={onClose} variant="outline" className="flex-1 text-xs h-8">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ComponentLibraryModalProps {
  isOpen: boolean;
  components: any[];
  thumbnails: Record<string, string>;
  onClose: () => void;
}

export function ComponentLibraryModal({
  isOpen,
  components,
  thumbnails,
  onClose,
}: ComponentLibraryModalProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filtered = components.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden bg-background border-border/50">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-lg font-bold uppercase tracking-widest text-brand-cyan">
            {t('plugin.brand.modals.libraryTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t('plugin.brand.modals.libraryDescription')}
          </DialogDescription>

          <div className="mt-4">
            <input
              type="text"
              placeholder={t('plugin.brand.modals.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-card border border-border/50 rounded-lg px-3 py-2 text-xs focus:border-brand-cyan/50 outline-none transition-all"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-2 custom-scrollbar">
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((comp) => {
              const thumb = comp.thumbnail || thumbnails[comp.id];
              return (
                <div
                  key={comp.id}
                  className="group bg-muted/40 border border-border/50 rounded-xl p-3 hover:border-brand-cyan/30 transition-all cursor-pointer"
                  onClick={() => {
                    parent.postMessage(
                      { pluginMessage: { type: 'SELECT_AND_ZOOM', nodeId: comp.id } },
                      'https://www.figma.com'
                    );
                  }}
                >
                  <div className="aspect-video bg-background rounded-lg mb-2 overflow-hidden flex items-center justify-center border border-border/50">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={comp.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <Layers size={24} className="text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground transition-colors truncate">
                    {comp.name}
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20 text-muted-foreground text-xs">
              {t('plugin.brand.modals.noSearchResults')}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/50 bg-muted/20 flex justify-end">
          <Button
            onClick={onClose}
            variant="ghost"
            className="text-xs h-8 text-muted-foreground uppercase tracking-widest"
          >
            {t('plugin.brand.modals.closeLibrary')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NamingGuideModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-background border-border/50 p-6 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-lg font-bold uppercase tracking-[0.2em] text-brand-cyan flex items-center gap-2">
            <BookOpen size={20} />
            {t('plugin.brand.modals.namingTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t('plugin.brand.modals.namingSubtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar text-xs leading-relaxed text-muted-foreground">
          <section className="space-y-2">
            <h4 className="font-bold text-foreground uppercase tracking-widest text-[10px]">
              {t('plugin.brand.modals.colorPalettes')}
            </h4>
            <p>{t('plugin.brand.modals.colorPalettesDesc')}</p>
            <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
              <div className="bg-card p-2 rounded">primary / 500</div>
              <div className="bg-card p-2 rounded">secondary / surface</div>
              <div className="bg-card p-2 rounded">accent / highlight</div>
              <div className="bg-card p-2 rounded">background / bg</div>
            </div>
            <p className="italic text-[9px]">{t('plugin.brand.modals.alsoSupports')}</p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-foreground uppercase tracking-widest text-[10px]">
              {t('plugin.brand.modals.typographyStyles')}
            </h4>
            <p>{t('plugin.brand.modals.typographyStylesDesc')}</p>
            <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
              <div className="bg-card p-2 rounded">Heading / H1</div>
              <div className="bg-card p-2 rounded">Title / Subtitle</div>
              <div className="bg-card p-2 rounded">Body / Paragraph</div>
              <div className="bg-card p-2 rounded">Small / Caption</div>
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-foreground uppercase tracking-widest text-[10px]">
              {t('plugin.brand.modals.assetLogos')}
            </h4>
            <p>{t('plugin.brand.modals.assetLogosDesc')}</p>
            <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
              <div className="bg-card p-2 rounded">Logo / Primary</div>
              <div className="bg-card p-2 rounded">Brand / Dark</div>
              <div className="bg-card p-2 rounded">Icon / Emblem</div>
              <div className="bg-card p-2 rounded">Logo / Accent</div>
            </div>
          </section>

          <div className="bg-brand-cyan/5 border border-brand-cyan/10 p-3 rounded-lg flex items-start gap-2">
            <Info size={14} className="text-brand-cyan mt-0.5 shrink-0" />
            <p className="text-[9px] text-brand-cyan/80">{t('plugin.brand.modals.proTip')}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="h-8 border-border/50 uppercase tracking-widest text-[9px]"
          >
            {t('plugin.brand.modals.gotIt')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Layers, BookOpen, Info } from 'lucide-react';
