import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

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
                  { value: 'logo', label: '📎 Logo' },
                  { value: 'font', label: '🔤 Font' },
                  { value: 'color', label: '🎨 Color' },
                  { value: 'component', label: '📦 Component' },
                  { value: 'skip', label: '✕ Skip' }
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
              <Checkbox
                checked={selected.includes('colors')}
                onChange={() => handleToggle('colors')}
              />
              <span className="text-xs">
                Colors <span className="text-muted-foreground">({changes.colors.length} new)</span>
              </span>
            </label>
          )}

          {changes.typography && changes.typography.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={selected.includes('typography')}
                onChange={() => handleToggle('typography')}
              />
              <span className="text-xs">
                Typography <span className="text-muted-foreground">({changes.typography.length} new)</span>
              </span>
            </label>
          )}

          {changes.logos && changes.logos.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={selected.includes('logos')}
                onChange={() => handleToggle('logos')}
              />
              <span className="text-xs">
                Logos <span className="text-muted-foreground">({changes.logos.length} new)</span>
              </span>
            </label>
          )}

          {changes.tokens && Object.keys(changes.tokens).length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={selected.includes('tokens')}
                onChange={() => handleToggle('tokens')}
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
