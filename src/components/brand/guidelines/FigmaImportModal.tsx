import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Check, X, Palette, Type, Image as ImageIcon } from 'lucide-react';

interface FigmaImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  guidelineId: string;
  previewData: {
    colors: Array<{ hex: string; name: string; role?: string }>;
    typography: Array<{ family: string; role: string }>;
    components: Array<{ key: string; name: string; thumbnailUrl?: string }>;
  };
  onImportComplete: () => void;
}

export const FigmaImportModal: React.FC<FigmaImportModalProps> = ({
  isOpen,
  onClose,
  guidelineId,
  previewData,
  onImportComplete,
}) => {
  const [importColors, setImportColors] = useState(true);
  const [importTypography, setImportTypography] = useState(true);
  const [selectedLogos, setSelectedLogos] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const toggleLogo = (key: string) => {
    setSelectedLogos((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await brandGuidelineApi.importFromFigma(guidelineId, {
        importColors,
        importTypography,
        selectedLogos,
      });

      toast.success(
        `Importado com sucesso: ${result.imported.colors} cores, ${result.imported.typography} fontes, ${result.imported.logos} logos`
      );
      onImportComplete();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao importar do Figma');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-neutral-900 border-neutral-800 text-neutral-200 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b border-neutral-800/50">
          <DialogTitle className="text-xl font-bold font-manrope flex items-center gap-2">
            <Palette className="text-brand-cyan" size={20} />
            Importar do Figma
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Colors section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <div className={`p-1 rounded ${importColors ? 'bg-brand-cyan/20 text-brand-cyan' : 'bg-neutral-800 text-neutral-500'}`}>
                  <Palette size={14} />
                </div>
                <span>Cores ({previewData.colors.length})</span>
              </div>
              <Switch
                checked={importColors}
                onCheckedChange={(checked) => setImportColors(!!checked)}
              />
            </div>
            {importColors && previewData.colors.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-neutral-950/50 rounded-xl border border-neutral-800/50">
                {previewData.colors.slice(0, 12).map((color, idx) => (
                  <div
                    key={idx}
                    className="w-8 h-8 rounded-md border border-white/10 shadow-sm"
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
                {previewData.colors.length > 12 && (
                  <div className="w-8 h-8 rounded-md bg-neutral-800 flex items-center justify-center text-[10px] text-neutral-500 font-mono">
                    +{previewData.colors.length - 12}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Typography section */}
          <div className="space-y-3 pt-2 border-t border-neutral-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <div className={`p-1 rounded ${importTypography ? 'bg-brand-cyan/20 text-brand-cyan' : 'bg-neutral-800 text-neutral-500'}`}>
                  <Type size={14} />
                </div>
                <span>Tipografia ({previewData.typography.length})</span>
              </div>
              <Switch
                checked={importTypography}
                onCheckedChange={(checked) => setImportTypography(!!checked)}
              />
            </div>
            {importTypography && previewData.typography.length > 0 && (
              <div className="space-y-1.5 p-3 bg-neutral-950/50 rounded-xl border border-neutral-800/50">
                {previewData.typography.slice(0, 4).map((font, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400 font-mono italic">{font.role}</span>
                    <span className="font-bold">{font.family}</span>
                  </div>
                ))}
                {previewData.typography.length > 4 && (
                  <p className="text-[10px] text-neutral-600 font-mono text-center pt-1 border-t border-neutral-800/30">
                    + {previewData.typography.length - 4} estilos adicionais
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Components / Logos section */}
          <div className="space-y-3 pt-2 border-t border-neutral-800/50">
            <div className="flex items-center gap-2 font-medium">
              <div className="p-1 rounded bg-brand-cyan/20 text-brand-cyan">
                <ImageIcon size={14} />
              </div>
              <span>Logos (selecione os componentes)</span>
            </div>
            
            {previewData.components.length === 0 ? (
              <p className="text-xs text-neutral-500 italic p-3 text-center bg-neutral-950/30 rounded-xl border border-dashed border-neutral-800">
                Nenhum componente encontrado no arquivo.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {previewData.components.map((comp) => (
                  <div
                    key={comp.key}
                    onClick={() => toggleLogo(comp.key)}
                    className={`
                      relative flex flex-col items-center p-3 rounded-xl border cursor-pointer transition-all gap-2
                      ${selectedLogos.includes(comp.key)
                        ? 'bg-brand-cyan/5 border-brand-cyan shadow-[0_0_10px_rgba(0,186,242,0.1)]'
                        : 'bg-neutral-950/50 border-neutral-800 hover:border-neutral-700'}
                    `}
                  >
                    {comp.thumbnailUrl ? (
                      <div className="w-full h-16 rounded bg-neutral-900 border border-neutral-800/50 flex items-center justify-center p-2 group-hover:bg-neutral-800 transition-colors">
                         <img src={comp.thumbnailUrl} alt={comp.name} className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-full h-16 rounded bg-neutral-900 border border-neutral-800/50 flex items-center justify-center">
                        <ImageIcon className="text-neutral-700" size={24} />
                      </div>
                    )}
                    <span className="text-[10px] font-mono text-neutral-400 truncate w-full text-center">
                      {comp.name}
                    </span>
                    {selectedLogos.includes(comp.key) && (
                      <div className="absolute top-2 right-2 bg-brand-cyan text-black rounded-full p-0.5">
                        <Check size={8} strokeWidth={4} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-6 pt-2 border-t border-neutral-800/50 gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isImporting}
            className="text-neutral-400 font-mono text-xs"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || (!importColors && !importTypography && selectedLogos.length === 0)}
            className="bg-brand-cyan hover:bg-brand-cyan/90 text-black px-8 font-bold"
          >
            {isImporting ? <GlitchLoader size={16} /> : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
