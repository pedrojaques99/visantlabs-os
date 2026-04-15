import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
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

export function SmartScanModal({ isOpen, items, onApply, onClose }: SmartScanModalProps) {
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
          <DialogTitle className="text-sm font-semibold">Smart Scan Results</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Categorize detected design elements</p>
        </DialogHeader>

        <div className="space-y-2">
          {categorized.map((item) => (
            <div key={item.id} className="border border-border rounded p-2 space-y-2">
              <div className="flex items-center gap-2">
                {item.thumbnail && <img src={item.thumbnail} alt={item.name} className="w-8 h-8 rounded" />}
                <div className="flex-1">
                  <p className="text-xs font-mono font-semibold">{item.name}</p>
                  {item.metadata && <p className="text-[10px] text-muted-foreground">{JSON.stringify(item.metadata)}</p>}
                </div>
              </div>

              <Select
                options={[
                  { value: 'logo', label: 'Logo' },
                  { value: 'font', label: 'Font' },
                  { value: 'color', label: 'Color' },
                  { value: 'component', label: 'Component' },
                  { value: 'skip', label: 'Skip' }
                ]}
                value={item.category || 'skip'}
                onChange={(value) => handleCategoryChange(item.id, value as string)}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleApply} className="flex-1 bg-brand-cyan text-black hover:bg-brand-cyan/90 text-xs h-8">
            Apply
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
          <DialogTitle className="text-sm font-semibold">Push to Web App</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Select what to push to your brand guideline</p>
        </DialogHeader>

        <div className="space-y-3">
          {changes.colors && changes.colors.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={selected.includes('colors')}
                onCheckedChange={() => handleToggle('colors')}
              />
              <span className="text-xs">
                Colors <span className="text-muted-foreground">({changes.colors.length} new)</span>
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
                Typography <span className="text-muted-foreground">({changes.typography.length} new)</span>
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
                Logos <span className="text-muted-foreground">({changes.logos.length} new)</span>
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
                Design Tokens <span className="text-muted-foreground">({Object.keys(changes.tokens).length} new)</span>
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
            Push
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

export function ComponentLibraryModal({ isOpen, components, thumbnails, onClose }: ComponentLibraryModalProps) {
  const [search, setSearch] = useState('');
  
  const filtered = components.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden bg-neutral-950 border-white/5">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-lg font-bold uppercase tracking-widest text-brand-cyan">Library Index</DialogTitle>
          <p className="text-xs text-neutral-500">View and insert components from your design system</p>
          
          <div className="mt-4">
            <input 
              type="text"
              placeholder="Search components..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-900 border border-white/5 rounded-lg px-3 py-2 text-xs focus:border-brand-cyan/50 outline-none transition-all"
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
                  className="group bg-neutral-900/40 border border-white/5 rounded-xl p-3 hover:border-brand-cyan/30 transition-all cursor-pointer"
                  onClick={() => {
                    parent.postMessage({ pluginMessage: { type: 'SELECT_AND_ZOOM', nodeId: comp.id } }, 'https://www.figma.com');
                  }}
                >
                  <div className="aspect-video bg-neutral-950 rounded-lg mb-2 overflow-hidden flex items-center justify-center border border-white/5">
                    {thumb ? (
                      <img src={thumb} alt={comp.name} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Layers size={24} className="text-neutral-800" />
                    )}
                  </div>
                  <div className="text-[10px] font-bold text-neutral-400 group-hover:text-white transition-colors truncate">
                    {comp.name}
                  </div>
                </div>
              );
            })}
          </div>
          
          {filtered.length === 0 && (
            <div className="text-center py-20 text-neutral-500 text-xs">
              No components matching your search.
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-white/5 bg-neutral-900/20 flex justify-end">
          <Button onClick={onClose} variant="ghost" className="text-xs h-8 text-neutral-500 uppercase tracking-widest">
            Close Library
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NamingGuideModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-neutral-950 border-white/5 p-6 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-lg font-bold uppercase tracking-[0.2em] text-brand-cyan flex items-center gap-2">
            <BookOpen size={20} />
            Naming Guide
          </DialogTitle>
          <p className="text-xs text-neutral-500">How to name layers for Smart Integration</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar text-xs leading-relaxed text-neutral-400">
          <section className="space-y-2">
            <h4 className="font-bold text-white uppercase tracking-widest text-[10px]">🎨 Color Palettes</h4>
            <p>Smart Import detects colors via Variables or Styles using these patterns:</p>
            <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
              <div className="bg-neutral-900 p-2 rounded">primary / 500</div>
              <div className="bg-neutral-900 p-2 rounded">secondary / surface</div>
              <div className="bg-neutral-900 p-2 rounded">accent / highlight</div>
              <div className="bg-neutral-900 p-2 rounded">background / bg</div>
            </div>
            <p className="italic text-[9px]">* Also supports: danger, success, warning, neutral.</p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-white uppercase tracking-widest text-[10px]">🔤 Typography Styles</h4>
            <p>Detection happens via Text Styles or selected Text layers:</p>
            <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
              <div className="bg-neutral-900 p-2 rounded">Heading / H1</div>
              <div className="bg-neutral-900 p-2 rounded">Title / Subtitle</div>
              <div className="bg-neutral-900 p-2 rounded">Body / Paragraph</div>
              <div className="bg-neutral-900 p-2 rounded">Small / Caption</div>
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-white uppercase tracking-widest text-[10px]">🛡️ Asset Logos</h4>
            <p>Components named with these keywords go straight to logo slots:</p>
            <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
              <div className="bg-neutral-900 p-2 rounded">Logo / Primary</div>
              <div className="bg-neutral-900 p-2 rounded">Brand / Dark</div>
              <div className="bg-neutral-900 p-2 rounded">Icon / Emblem</div>
              <div className="bg-neutral-900 p-2 rounded">Logo / Accent</div>
            </div>
          </section>

          <div className="bg-brand-cyan/5 border border-brand-cyan/10 p-3 rounded-lg flex items-start gap-2">
            <Info size={14} className="text-brand-cyan mt-0.5 shrink-0" />
            <p className="text-[9px] text-brand-cyan/80">
              Pro Tip: You can group layers (e.g., Folder/Logo) and the plugin will still find the correct keywords inside.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose} variant="outline" size="sm" className="h-8 border-white/5 uppercase tracking-widest text-[9px]">
            Got it, thanks!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Layers, BookOpen, Info } from 'lucide-react';
