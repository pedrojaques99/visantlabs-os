import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { X, FileText, Trash2 } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { budgetApi } from '@/services/budgetApi';
import { toast } from 'sonner';
import type { CustomPdfPreset } from '@/types/types';

interface PdfPresetSelectorProps {
  selectedPresetId?: string;
  onPresetSelect: (preset: CustomPdfPreset | null) => void;
  onPresetDelete?: (presetId: string) => void;
}

export const PdfPresetSelector: React.FC<PdfPresetSelectorProps> = ({
  selectedPresetId,
  onPresetSelect,
  onPresetDelete,
}) => {
  const { t } = useTranslation();
  const [presets, setPresets] = useState<CustomPdfPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      setIsLoading(true);
      const fetchedPresets = await budgetApi.getPdfPresets();
      setPresets(fetchedPresets);
    } catch (error: any) {
      console.error('Error loading presets:', error);
      toast.error('Falha ao carregar presets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Tem certeza que deseja deletar este preset?')) {
      return;
    }

    try {
      setDeletingId(presetId);
      await budgetApi.deletePdfPreset(presetId);
      setPresets(presets.filter(p => p._id !== presetId && p.id !== presetId));

      if (selectedPresetId === presetId) {
        onPresetSelect(null);
      }

      if (onPresetDelete) {
        onPresetDelete(presetId);
      }

      toast.success('Preset deletado com sucesso');
    } catch (error: any) {
      console.error('Error deleting preset:', error);
      toast.error(error.message || 'Falha ao deletar preset');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 border border-zinc-800 rounded-xl bg-black/20">
        <GlitchLoader size={16} color="brand-cyan" />
        <span className="text-sm text-zinc-400 font-mono">
          Carregando presets...
        </span>
      </div>
    );
  }

  if (presets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs mb-2 font-mono text-zinc-400">
        Presets Salvos
      </label>
      <div className="grid grid-cols-1 gap-2">
        {presets.map((preset) => {
          const presetId = preset._id || preset.id;
          const isSelected = selectedPresetId === presetId;

          return (
            <div
              key={presetId}
              onClick={() => onPresetSelect(preset)}
              className={`
                relative p-3 border rounded-xl cursor-pointer transition-all
                ${isSelected
                  ? 'border-[brand-cyan] bg-brand-cyan/10'
                  : 'border-zinc-800 bg-black/20 hover:bg-black/30'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-zinc-300 truncate">
                    {preset.name}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(preset.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(presetId, e)}
                  disabled={deletingId === presetId}
                  className="p-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-md text-red-400 transition-colors disabled:opacity-50 flex-shrink-0"
                  title="Deletar preset"
                >
                  {deletingId === presetId ? (
                    <GlitchLoader size={16} />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
                <FileText className="h-5 w-5 text-brand-cyan flex-shrink-0" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};






