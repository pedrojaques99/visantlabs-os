import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { FormInput } from '@/components/ui/form-input';
import { FormTextarea } from '@/components/ui/form-textarea';
import type { GiftOption } from '@/types/types';
import { Plus, Trash2 } from 'lucide-react';

interface GiftOptionsSectionProps {
  giftOptions: GiftOption[];
  onChange: (giftOptions: GiftOption[]) => void;
}

export const GiftOptionsSection: React.FC<GiftOptionsSectionProps> = ({
  giftOptions,
  onChange,
}) => {
  const { t } = useTranslation();

  const addGiftOption = () => {
    onChange([
      ...giftOptions,
      { title: '', description: '' },
    ]);
  };

  const removeGiftOption = (index: number) => {
    onChange(giftOptions.filter((_, i) => i !== index));
  };

  const updateGiftOption = (index: number, field: keyof GiftOption, value: any) => {
    const updated = [...giftOptions];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-200 font-mono">
          {t('budget.giftOptions') || 'Opções de Brinde'}
        </h3>
        <button
          onClick={addGiftOption}
          className="px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/50 rounded-xl text-brand-cyan font-mono text-sm transition-all duration-300 flex items-center gap-2"
        >
          <Plus size={16} />
          {t('budget.addGiftOption') || 'Adicionar Brinde'}
        </button>
      </div>

      {giftOptions.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 font-mono text-sm">
          {t('budget.noGiftOptions') || 'Nenhuma opção de brinde adicionada ainda'}
        </div>
      ) : (
        <div className="space-y-4">
          {giftOptions.map((gift, index) => (
            <div
              key={index}
              className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-mono">
                      {t('budget.giftTitle') || 'Título'}
                    </label>
                    <FormInput
                      value={gift.title}
                      onChange={(e) =>
                        updateGiftOption(index, 'title', e.target.value)
                      }
                      placeholder={t('budget.placeholders.giftTitle') || 'Título do brinde'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-mono">
                      {t('budget.giftDescription') || 'Descrição'}
                    </label>
                    <FormTextarea
                      value={gift.description}
                      onChange={(e) =>
                        updateGiftOption(index, 'description', e.target.value)
                      }
                      placeholder={t('budget.placeholders.giftDescription') || 'Descrição do brinde'}
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-mono">
                      {t('budget.giftImageUrl') || 'URL da Imagem (opcional)'}
                    </label>
                    <FormInput
                      value={gift.imageUrl || ''}
                      onChange={(e) =>
                        updateGiftOption(index, 'imageUrl', e.target.value)
                      }
                      placeholder={t('budget.placeholders.giftImageUrl') || 'https://...'}
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeGiftOption(index)}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                  title={t('budget.removeGiftOption') || 'Remover brinde'}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

