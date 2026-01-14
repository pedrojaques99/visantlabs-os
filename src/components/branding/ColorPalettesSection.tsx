import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Textarea } from '@/components/ui/textarea';

interface ColorPalette {
  name: string;
  colors: string[];
  psychology: string;
}

interface ColorPalettesSectionProps {
  palettes: ColorPalette[];
  isEditing?: boolean;
  onContentChange?: (value: ColorPalette[]) => void;
}

export const ColorPalettesSection: React.FC<ColorPalettesSectionProps> = ({
  palettes,
  isEditing = false,
  onContentChange,
}) => {
  const { theme } = useTheme();
  const [localPalettes, setLocalPalettes] = useState<ColorPalette[]>(palettes);

  useEffect(() => {
    setLocalPalettes(palettes);
  }, [palettes]);

  const updatePalettes = (newPalettes: ColorPalette[]) => {
    setLocalPalettes(newPalettes);
    if (onContentChange) {
      onContentChange(newPalettes);
    }
  };

  const handleNameChange = (index: number, name: string) => {
    const newPalettes = [...localPalettes];
    newPalettes[index] = { ...newPalettes[index], name };
    updatePalettes(newPalettes);
  };

  const handleColorChange = (paletteIndex: number, colorIndex: number, color: string) => {
    const newPalettes = [...localPalettes];
    const newColors = [...newPalettes[paletteIndex].colors];
    newColors[colorIndex] = color;
    newPalettes[paletteIndex] = { ...newPalettes[paletteIndex], colors: newColors };
    updatePalettes(newPalettes);
  };

  const handleAddColor = (paletteIndex: number) => {
    const newPalettes = [...localPalettes];
    const newColors = [...newPalettes[paletteIndex].colors, '#000000'];
    newPalettes[paletteIndex] = { ...newPalettes[paletteIndex], colors: newColors };
    updatePalettes(newPalettes);
  };

  const handleRemoveColor = (paletteIndex: number, colorIndex: number) => {
    const newPalettes = [...localPalettes];
    const newColors = newPalettes[paletteIndex].colors.filter((_, i) => i !== colorIndex);
    newPalettes[paletteIndex] = { ...newPalettes[paletteIndex], colors: newColors };
    updatePalettes(newPalettes);
  };

  const handlePsychologyChange = (index: number, psychology: string) => {
    const newPalettes = [...localPalettes];
    newPalettes[index] = { ...newPalettes[index], psychology };
    updatePalettes(newPalettes);
  };

  const handleAddPalette = () => {
    const newPalettes = [
      ...localPalettes,
      { name: '', colors: ['#000000'], psychology: '' },
    ];
    updatePalettes(newPalettes);
  };

  const handleRemovePalette = (index: number) => {
    const newPalettes = localPalettes.filter((_, i) => i !== index);
    updatePalettes(newPalettes);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {localPalettes.map((palette, index) => (
          <div
            key={index}
            className={`border rounded-xl p-5 hover:border-[brand-cyan]/50 transition-colors relative ${theme === 'dark'
              ? 'border-neutral-800/60 bg-black/40'
              : 'border-neutral-300 bg-neutral-100'
              }`}
          >
            {isEditing && onContentChange && (
              <button
                onClick={() => handleRemovePalette(index)}
                className={`absolute top-2 right-2 p-1 hover:bg-red-500/20 rounded transition-colors hover:text-red-400 ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
                  }`}
                title="Remover paleta"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {isEditing && onContentChange ? (
              <input
                type="text"
                value={palette.name}
                onChange={(e) => handleNameChange(index, e.target.value)}
                placeholder="Nome da paleta"
                className={`font-semibold mb-4 font-manrope text-lg bg-transparent border-b-2 focus:border-[brand-cyan] focus:outline-none pb-1 w-full ${theme === 'dark'
                  ? 'text-neutral-200 border-neutral-700/50'
                  : 'text-neutral-800 border-neutral-400/50'
                  }`}
              />
            ) : (
              <h4 className={`font-semibold mb-4 font-manrope text-lg ${theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
                }`}>
                {palette.name}
              </h4>
            )}

            {/* Grid de cores com hex codes */}
            <div className="grid grid-cols-5 gap-3 mb-4">
              {palette.colors.map((color, colorIndex) => (
                <div key={colorIndex} className="flex flex-col items-center">
                  {isEditing && onContentChange ? (
                    <div className="w-full space-y-1">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => handleColorChange(index, colorIndex, e.target.value)}
                        className="w-full aspect-square rounded-md border border-neutral-800/60 cursor-pointer"
                        title={color}
                      />
                      <input
                        type="text"
                        value={color.toUpperCase()}
                        onChange={(e) => handleColorChange(index, colorIndex, e.target.value)}
                        placeholder="#000000"
                        className={`text-xs font-mono font-medium bg-transparent border rounded px-1 w-full text-center ${theme === 'dark'
                          ? 'text-neutral-500 border-neutral-700/50'
                          : 'text-neutral-600 border-neutral-400/50'
                          }`}
                      />
                      <button
                        onClick={() => handleRemoveColor(index, colorIndex)}
                        className={`w-full p-1 hover:bg-red-500/20 rounded transition-colors hover:text-red-400 text-xs ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
                          }`}
                        title="Remover cor"
                      >
                        <X className="h-3 w-3 mx-auto" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`w-full aspect-square rounded-md border transition-all duration-300 hover:scale-[1.05] hover:shadow-lg hover:shadow-[brand-cyan]/20 mb-2 ${theme === 'dark' ? 'border-neutral-800/60' : 'border-neutral-300'
                          }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                      <span className={`text-xs font-mono font-medium ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'
                        }`}>
                        {color.toUpperCase()}
                      </span>
                    </>
                  )}
                </div>
              ))}
              {isEditing && onContentChange && (
                <button
                  onClick={() => handleAddColor(index)}
                  className={`flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-md transition-colors hover:border-[brand-cyan]/50 hover:text-brand-cyan ${theme === 'dark'
                    ? 'border-neutral-700/50 text-neutral-400'
                    : 'border-neutral-400/50 text-neutral-500'
                    }`}
                  title="Adicionar cor"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Descrição da paleta */}
            <div className={`pt-2 border-t ${theme === 'dark' ? 'border-neutral-800/40' : 'border-neutral-300'
              }`}>
              {isEditing && onContentChange ? (
                <Textarea
                  value={palette.psychology}
                  onChange={(e) => handlePsychologyChange(index, e.target.value)}
                  placeholder="Descrição da psicologia da paleta..."
                  className={`bg-transparent font-manrope text-sm min-h-[80px] ${theme === 'dark'
                    ? 'border-neutral-700/50 text-neutral-400'
                    : 'border-neutral-400/50 text-neutral-600'
                    }`}
                />
              ) : (
                <p className={`text-sm font-manrope leading-relaxed ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
                  }`}>
                  {palette.psychology}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      {isEditing && onContentChange && (
        <button
          onClick={handleAddPalette}
          className={`flex items-center gap-2 px-4 py-2 border hover:border-[brand-cyan]/50 hover:text-brand-cyan rounded-xl text-sm font-mono transition-all duration-300 ${theme === 'dark'
            ? 'bg-black/40 border-neutral-800/60 text-neutral-300'
            : 'bg-neutral-100 border-neutral-300 text-neutral-800'
            }`}
        >
          <Plus className="h-4 w-4" />
          Adicionar paleta
        </button>
      )}
    </div>
  );
};

