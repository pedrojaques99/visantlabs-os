import React, { useRef, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { usePluginStore } from '../../store';
import { useBrandSync } from '../../hooks/useBrandSync';
import { MousePointer2, Pipette } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { cn } from '@/lib/utils';

const getColorRoles = (t: (key: string) => string) => [
  { role: 'primary', label: t('plugin.brand.colorGrid.rolePri') },
  { role: 'secondary', label: t('plugin.brand.colorGrid.roleSec') },
  { role: 'accent', label: t('plugin.brand.colorGrid.roleAcc') },
  { role: 'background', label: t('plugin.brand.colorGrid.roleBg') },
  { role: 'surface', label: t('plugin.brand.colorGrid.roleSrf') },
  { role: 'text', label: t('plugin.brand.colorGrid.roleTxt') },
];

export function BrandColorGrid() {
  const { t } = useTranslation();
  const COLOR_ROLES = getColorRoles(t);
  const { selectedColors, addSelectedColor, designTokens, linkedGuideline } = usePluginStore();
  const { updateBrandGuideline } = useBrandSync();
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [pendingHex, setPendingHex] = useState<{ hex: string; name?: string } | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const syncColors = React.useCallback(
    (newColorsMap: Map<string, any>) => {
      if (linkedGuideline) {
        const colorsArray = Array.from(newColorsMap.values()).map((c) => ({
          hex: c.hex,
          name: c.role || c.name || 'Color',
          role: c.role,
        }));
        updateBrandGuideline(linkedGuideline, { colors: colorsArray as any });
      }
    },
    [linkedGuideline, updateBrandGuideline]
  );

  const setColor = React.useCallback(
    (role: string, hex: string, name?: string) => {
      addSelectedColor(role, { role, hex, name });
      const nextMap = new Map(selectedColors);
      nextMap.set(role, { role, hex, name });
      syncColors(nextMap);
    },
    [selectedColors, addSelectedColor, syncColors]
  );

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (msg?.type === 'SELECTION_FILL_RESULT' && activeRole) {
        setColor(activeRole, msg.hex, msg.name);
        setIsCapturing(false);
        setActiveRole(null);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [activeRole, setColor]);

  const figmaColors: Array<{ name?: string; hex: string }> = (designTokens as any)?.colors || [];

  const handleNativeColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeRole && e.target.value) {
      setColor(activeRole, e.target.value.toUpperCase());
      setActiveRole(null);
    }
  };

  const handleSlotClick = (role: string) => {
    if (pendingHex) {
      setColor(role, pendingHex.hex, pendingHex.name);
      setPendingHex(null);
    } else {
      setActiveRole(role);
      setIsCapturing(true);
      parent.postMessage(
        { pluginMessage: { type: 'GET_SELECTION_FILL' } },
        'https://www.figma.com'
      );
    }
  };

  const openNativePicker = (role: string) => {
    setActiveRole(role);
    colorInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      {/* File Variables — pick a color first */}
      {figmaColors.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground/70 px-0.5">
            {t('plugin.brand.colorGrid.fileVariables')}
          </p>
          <div className="flex flex-wrap gap-1">
            {figmaColors.slice(0, 16).map((c, i) => {
              const hex = c.hex || (c as any).value;
              const isSelected = pendingHex?.hex === hex;
              return (
                <button
                  key={`${hex}-${i}`}
                  type="button"
                  onClick={() => setPendingHex(isSelected ? null : { hex, name: c.name })}
                  title={c.name || hex}
                  className={cn(
                    'w-5 h-5 rounded border transition-all hover:scale-110',
                    isSelected
                      ? 'border-brand-cyan ring-1 ring-brand-cyan/50 scale-110'
                      : 'border-border hover:border-brand-cyan/40'
                  )}
                  style={{ backgroundColor: hex }}
                />
              );
            })}
          </div>
          <p className="text-[8px] text-muted-foreground italic px-0.5">
            {pendingHex
              ? t('plugin.brand.colorGrid.selected', { name: pendingHex.name || pendingHex.hex })
              : t('plugin.brand.colorGrid.tapHint')}
          </p>
        </div>
      )}

      {/* Color Slots */}
      <div className="grid grid-cols-6 gap-1.5">
        {COLOR_ROLES.map((item) => {
          const color = selectedColors.get(item.role);
          const isActive = activeRole === item.role && isCapturing;
          const awaitingSlot = !!pendingHex;
          return (
            <div key={item.role} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => handleSlotClick(item.role)}
                onDoubleClick={() => openNativePicker(item.role)}
                title={
                  pendingHex
                    ? t('plugin.brand.colorGrid.assign', { hex: pendingHex.hex, label: item.label })
                    : t('plugin.brand.colorGrid.clickHint')
                }
                className={cn(
                  'w-full aspect-square rounded-lg border transition-all relative overflow-hidden group',
                  awaitingSlot && 'border-brand-cyan/40 animate-pulse'
                )}
                style={{
                  backgroundColor: color?.hex || 'transparent',
                  borderColor: awaitingSlot
                    ? undefined
                    : color
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(255,255,255,0.15)',
                  borderStyle: color ? 'solid' : 'dashed',
                }}
              >
                {isActive ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <GlitchLoader size={10} />
                  </span>
                ) : awaitingSlot && !color ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Pipette size={10} className="text-brand-cyan" />
                  </span>
                ) : !color ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <MousePointer2
                      size={10}
                      className="text-muted-foreground/70 group-hover:text-brand-cyan transition-colors"
                    />
                  </span>
                ) : null}
              </button>
              <span className="text-[8px] font-mono uppercase text-muted-foreground leading-none">
                {item.label}
              </span>
              {color && (
                <span className="text-[7px] font-mono text-muted-foreground/70 leading-none">
                  {color.hex}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <input ref={colorInputRef} type="color" onChange={handleNativeColor} className="hidden" />
    </div>
  );
}
