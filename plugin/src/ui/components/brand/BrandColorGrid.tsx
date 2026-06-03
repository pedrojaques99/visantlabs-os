import React, { useRef, useState } from 'react';
import { usePluginStore } from '../../store';
import { useBrandSync } from '../../hooks/useBrandSync';
import { MousePointer2 } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';

const COLOR_ROLES = [
  { role: 'primary', label: 'Pri' },
  { role: 'secondary', label: 'Sec' },
  { role: 'accent', label: 'Acc' },
  { role: 'background', label: 'Bg' },
  { role: 'surface', label: 'Srf' },
  { role: 'text', label: 'Txt' },
];

export function BrandColorGrid() {
  const { selectedColors, addSelectedColor, designTokens, linkedGuideline } = usePluginStore();
  const { updateBrandGuideline } = useBrandSync();
  const colorInputRef = useRef<HTMLInputElement>(null);
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

  const pickFromSelection = (role: string) => {
    setActiveRole(role);
    setIsCapturing(true);
    parent.postMessage({ pluginMessage: { type: 'GET_SELECTION_FILL' } }, 'https://www.figma.com');
  };

  const openNativePicker = (role: string) => {
    setActiveRole(role);
    colorInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-1.5">
        {COLOR_ROLES.map((item) => {
          const color = selectedColors.get(item.role);
          const isActive = activeRole === item.role && isCapturing;
          return (
            <div key={item.role} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => pickFromSelection(item.role)}
                onDoubleClick={() => openNativePicker(item.role)}
                title="Click: pick from selection · Double-click: custom color"
                className="w-full aspect-square rounded-lg border transition-all relative overflow-hidden group"
                style={{
                  backgroundColor: color?.hex || 'transparent',
                  borderColor: color ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)',
                  borderStyle: color ? 'solid' : 'dashed',
                }}
              >
                {isActive ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <GlitchLoader size={10} />
                  </span>
                ) : !color ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <MousePointer2
                      size={10}
                      className="text-neutral-600 group-hover:text-brand-cyan transition-colors"
                    />
                  </span>
                ) : null}
              </button>
              <span className="text-[8px] font-mono uppercase text-neutral-500 leading-none">
                {item.label}
              </span>
              {color && (
                <span className="text-[7px] font-mono text-neutral-600 leading-none">
                  {color.hex}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {figmaColors.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[8px] font-mono uppercase tracking-widest text-neutral-600 px-0.5">
            File variables
          </p>
          <div className="flex flex-wrap gap-1">
            {figmaColors.slice(0, 16).map((c, i) => {
              const hex = c.hex || (c as any).value;
              return (
                <button
                  key={`${hex}-${i}`}
                  type="button"
                  onClick={() => {
                    if (activeRole) {
                      setColor(activeRole, hex, c.name);
                      setActiveRole(null);
                    }
                  }}
                  title={c.name || hex}
                  disabled={!activeRole}
                  className="w-5 h-5 rounded border border-white/10 transition-all hover:scale-110 hover:border-brand-cyan/40 disabled:opacity-30 disabled:hover:scale-100"
                  style={{ backgroundColor: hex }}
                />
              );
            })}
          </div>
          {!activeRole && figmaColors.length > 0 && (
            <p className="text-[8px] text-neutral-600 italic px-0.5">
              Click a color slot first, then pick from variables
            </p>
          )}
        </div>
      )}

      <input ref={colorInputRef} type="color" onChange={handleNativeColor} className="hidden" />
    </div>
  );
}
