import React, { useRef, useState } from 'react';
import { usePluginStore } from '../../store';
import { useBrandSync } from '../../hooks/useBrandSync';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const COLOR_ROLES = [
  { role: 'primary', label: 'Primary' },
  { role: 'secondary', label: 'Secondary' },
  { role: 'accent', label: 'Accent' },
  { role: 'background', label: 'Background' },
  { role: 'surface', label: 'Surface' },
  { role: 'text', label: 'Text' }
];

export function BrandColorGrid() {
  const { selectedColors, addSelectedColor, designTokens, linkedGuideline } = usePluginStore();
  const { updateBrandGuideline } = useBrandSync();
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const syncColors = React.useCallback((newColorsMap: Map<string, any>) => {
    if (linkedGuideline) {
      const colorsArray = Array.from(newColorsMap.values()).map(c => ({
        hex: c.hex,
        name: c.role || c.name || 'Color',
        role: c.role
      }));
      updateBrandGuideline(linkedGuideline, { colors: colorsArray as any });
    }
  }, [linkedGuideline, updateBrandGuideline]);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (msg?.type === 'SELECTION_FILL_RESULT' && selectedRole) {
        const hex = msg.hex;
        addSelectedColor(selectedRole, { role: selectedRole, hex, name: msg.name });
        
        const nextMap = new Map(selectedColors);
        nextMap.set(selectedRole, { role: selectedRole, hex, name: msg.name });
        syncColors(nextMap);
        
        setIsCapturing(false);
        setPickerOpen(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [selectedRole, selectedColors, addSelectedColor, syncColors]);

  const figmaColors: Array<{ name?: string; hex: string }> = (designTokens as any)?.colors || [];

  const handleColorClick = (role: string) => {
    setSelectedRole(role);
    setPickerOpen(true);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedRole && e.target.value) {
      const hex = e.target.value.toUpperCase();
      addSelectedColor(selectedRole, { role: selectedRole, hex });
      
      const nextMap = new Map(selectedColors);
      nextMap.set(selectedRole, { role: selectedRole, hex });
      syncColors(nextMap);
    }
  };

  const pickFigmaColor = (hex: string, name?: string) => {
    if (selectedRole) {
      addSelectedColor(selectedRole, { role: selectedRole, hex, name });
      
      const nextMap = new Map(selectedColors);
      nextMap.set(selectedRole, { role: selectedRole, hex, name });
      syncColors(nextMap);
      
      setPickerOpen(false);
    }
  };

  const pickFromSelection = () => {
    setIsCapturing(true);
    parent.postMessage({ pluginMessage: { type: 'GET_SELECTION_FILL' } }, 'https://www.figma.com');
  };

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">Brand Colors</h3>
      <div className="grid grid-cols-3 gap-3">
        {COLOR_ROLES.map((item) => {
          const color = selectedColors.get(item.role);
          
          if (color) {
            return (
              <div
                key={item.role}
                onClick={() => handleColorClick(item.role)}
                className="flex flex-col items-center gap-2 group/color p-2 rounded-xl transition-all duration-300 cursor-pointer hover:bg-neutral-800/50"
              >
                <div
                  className="w-full aspect-square max-w-[56px] rounded-xl border border-white/5 shadow-lg group-hover/color:border-brand-cyan/50 transition-all duration-300 relative overflow-hidden hover:shadow-brand-cyan/20"
                  style={{ backgroundColor: color.hex }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover/color:opacity-100 transition-opacity" />
                </div>
                <div className="text-center min-w-0 w-full">
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-tight truncate">{item.label}</p>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">{color.hex}</p>
                </div>
              </div>
            );
          }

          // Empty state
          return (
            <div
              key={item.role}
              onClick={() => handleColorClick(item.role)}
              className="flex flex-col items-center justify-center gap-2 p-2 rounded-xl border border-white/[0.03] bg-neutral-900/40 opacity-70 cursor-pointer hover:bg-neutral-800/60 transition-colors group/empty"
            >
              <div className="w-full aspect-square max-w-[56px] rounded-xl border border-dashed border-white/20 group-hover/empty:border-brand-cyan/40 transition-colors flex items-center justify-center bg-transparent">
                <span className="text-white/20 group-hover/empty:text-brand-cyan/50 text-xl font-light">+</span>
              </div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground group-hover/empty:text-foreground transition-colors">{item.label}</span>
            </div>
          );
        })}
      </div>

      <input ref={colorInputRef} type="color" onChange={handleColorChange} className="hidden" />

      <Dialog 
        open={pickerOpen} 
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (open) parent.postMessage({ pluginMessage: { type: 'GET_CONTEXT' } }, 'https://www.figma.com');
        }}
      >
        <DialogContent className="max-w-md bg-neutral-950 border-white/5 p-6 overflow-hidden flex flex-col max-h-[80vh]">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-sm font-bold uppercase tracking-widest text-brand-cyan">
              Pick a color {selectedRole ? `for ${selectedRole}` : ''}
            </DialogTitle>
            <p className="text-[10px] text-neutral-500 mt-1">
              Select a color from your Figma file tokens or styles.
            </p>
          </DialogHeader>

          <div className="flex gap-2 mb-4">
            <Button
              onClick={pickFromSelection}
              disabled={isCapturing}
              className="flex-1 bg-brand-cyan text-black hover:bg-brand-cyan/90 text-[10px] h-9 font-bold uppercase tracking-widest"
            >
              {isCapturing ? <GlitchLoader size={12} className="mr-2" /> : <MousePointer2 size={14} className="mr-2" />}
              Pick from Selection
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 border-white/10"
              onClick={() => parent.postMessage({ pluginMessage: { type: 'GET_CONTEXT' } }, 'https://www.figma.com')}
            >
              <RefreshCw size={14} />
            </Button>
          </div>

          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-600 mb-3 px-1">Library Variables</p>

          {figmaColors.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-3 border border-dashed border-white/5 rounded-xl bg-neutral-900/20">
              <Palette size={24} className="text-neutral-800" />
              <div className="text-center">
                <p className="text-[9px] font-mono text-neutral-600 px-6 uppercase tracking-wider">No library styles found</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-4 gap-3">
                {figmaColors.map((c, i) => {
                  const colorVal = c.hex || (c as any).value;
                  return (
                    <button
                      key={`${colorVal}-${i}`}
                      type="button"
                      onClick={() => pickFigmaColor(colorVal, c.name)}
                      className="group flex flex-col items-center gap-2 p-1.5 rounded-xl transition-all hover:bg-white/[0.03]"
                    >
                      <div
                        className="w-full aspect-square rounded-lg border border-white/5 shadow-lg group-hover:border-brand-cyan/40 transition-all relative overflow-hidden"
                        style={{ backgroundColor: colorVal }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="min-w-0 w-full text-center">
                        <p className="text-[8px] font-bold text-neutral-400 group-hover:text-white uppercase truncate px-0.5">
                          {c.name || 'Color'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-6 pt-4 border-t border-white/5">
            <Button
              variant="outline"
              className="flex-1 text-[9px] font-bold uppercase tracking-widest h-9 border-white/5 hover:bg-white/5"
              onClick={() => {
                setPickerOpen(false);
                colorInputRef.current?.click();
              }}
            >
              Custom color…
            </Button>
            <Button 
              variant="ghost" 
              className="px-4 text-[9px] font-bold uppercase tracking-widest h-9 text-neutral-600 hover:text-white"
              onClick={() => setPickerOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { Palette, MousePointer2, RefreshCw } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
