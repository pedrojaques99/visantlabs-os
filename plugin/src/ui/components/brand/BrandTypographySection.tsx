import React, { useEffect, useMemo, useState } from 'react';
import { usePluginStore } from '../../store';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { MousePointer2, Type, RefreshCw } from 'lucide-react';
import { useBrandSync } from '../../hooks/useBrandSync';

type TypoSlot = 'primary' | 'secondary';

export function BrandTypographySection() {
  const { typography, updateTypography, designTokens, selectedFont, linkedGuideline } = usePluginStore();
  const { updateBrandGuideline } = useBrandSync();
  const { send } = useFigmaMessages();
  const [targetSlot, setTargetSlot] = useState<TypoSlot>('primary');

  const figmaStyles = useMemo(() => {
    return Array.isArray((designTokens as any)?.fonts) ? (designTokens as any).fonts : [];
  }, [designTokens]);

  const fontFamilies = useMemo(() => {
    const families = figmaStyles.map((f: any) => f.family).filter(Boolean);
    const fromFamilies = Array.isArray((designTokens as any)?.families) ? (designTokens as any).families : [];
    return Array.from(new Set<string>([...families, ...fromFamilies])).sort();
  }, [designTokens, figmaStyles]);

  // Sync with selection return
  useEffect(() => {
    if (selectedFont) {
      const data: any = { fontFamily: selectedFont.family };
      if (selectedFont.fontSize) data.fontSize = selectedFont.fontSize;
      if (selectedFont.lineHeight) data.lineHeight = selectedFont.lineHeight;
      if (selectedFont.style) data.fontStyle = selectedFont.style;

      updateTypography(targetSlot, data);
      syncToDatabase(targetSlot, data);
    }
  }, [selectedFont]);

  const syncToDatabase = (slot: TypoSlot, data: any) => {
    if (linkedGuideline) {
      const current = typography.find(t => t.name === slot);
      const updated = { ...current, ...data };
      updateBrandGuideline(linkedGuideline, { typography: typography.map(t => t.name === slot ? updated : t) as any });
    }
  };

  const handleUseSelection = (slot: TypoSlot) => {
    setTargetSlot(slot);
    send({ type: 'USE_SELECTION_AS_FONT' } as any);
  };

  const handleStyleSelect = (slot: TypoSlot, styleId: string) => {
    const style = figmaStyles.find((s: any) => s.id === styleId);
    if (style) {
      const data = {
        fontFamily: style.family,
        fontStyle: style.style,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight
      };
      updateTypography(slot, data);
      syncToDatabase(slot, data);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <p className="text-[10px] text-neutral-500 font-mono">
          {figmaStyles.length} styles / {fontFamilies.length} families found
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => send({ type: 'GET_CONTEXT' } as any)}
        >
          <RefreshCw size={12} className="text-neutral-500" />
        </Button>
      </div>

      <div className="space-y-6">
        {typography.map((typo) => (
          <div key={typo.name} className="space-y-3 p-3 bg-neutral-950/30 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type size={12} className="text-brand-cyan" />
                <label className="text-[10px] font-bold uppercase tracking-widest text-white">{typo.name}</label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleUseSelection(typo.name as TypoSlot)}
                className="h-6 px-2 text-[9px] uppercase tracking-widest font-bold text-neutral-500 hover:text-brand-cyan"
              >
                <MousePointer2 size={10} className="mr-1" />
                Use selection
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-600">Pick Figma Style</label>
              <Select
                options={figmaStyles.map((f: any) => ({ value: f.id, label: `${f.name} (${f.family} ${f.style || ''})` }))}
                value=""
                onChange={(val) => handleStyleSelect(typo.name as TypoSlot, val as string)}
                placeholder="Choose text style..."
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-600 px-1">Family</label>
                <Select
                  options={fontFamilies.map(f => ({ value: f, label: f }))}
                  value={typo.fontFamily || ''}
                  onChange={(val) => {
                    updateTypography(typo.name as TypoSlot, { fontFamily: val });
                    syncToDatabase(typo.name as TypoSlot, { fontFamily: val });
                  }}
                  placeholder="Font family"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-600 px-1">Weight / Style</label>
                <Input
                  placeholder="Regular, Bold..."
                  value={typo.fontStyle || ''}
                  onChange={(e) => {
                    updateTypography(typo.name as TypoSlot, { fontStyle: e.target.value });
                    syncToDatabase(typo.name as TypoSlot, { fontStyle: e.target.value });
                  }}
                  className="text-[10px] h-8 bg-neutral-950/50 border-white/5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-600 px-1">Size (px)</label>
                <Input
                  type="number"
                  placeholder="16"
                  value={typo.fontSize || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || undefined;
                    updateTypography(typo.name as TypoSlot, { fontSize: val });
                    syncToDatabase(typo.name as TypoSlot, { fontSize: val });
                  }}
                  className="text-[10px] h-8 bg-neutral-950/50 border-white/5 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-600 px-1">Line (px)</label>
                <Input
                  type="number"
                  placeholder="Auto"
                  value={typo.lineHeight || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || undefined;
                    updateTypography(typo.name as TypoSlot, { lineHeight: val });
                    syncToDatabase(typo.name as TypoSlot, { lineHeight: val });
                  }}
                  className="text-[10px] h-8 bg-neutral-950/50 border-white/5 font-mono"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
