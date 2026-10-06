import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { FormInput } from '@/components/ui/form-input';
import { FormTextarea } from '@/components/ui/form-textarea';
import type { GiftOption } from '@/types/types';
import { Plus, Trash2 } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';

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
    onChange([...giftOptions, { title: '', description: '' }]);
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
        <h3 className="text-lg font-medium text-foreground">{t('budget.giftOptions')}</h3>
        <Button
          variant="brand"
          onClick={addGiftOption}
          className="px-4 py-2 bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700 rounded-xl text-foreground text-sm transition-colors duration-300 flex items-center gap-2"
        >
          <Plus size={16} />
          {t('budget.addGiftOption')}
        </Button>
      </div>

      {giftOptions.length === 0 ? (
        <div className="text-center py-8 text-neutral-500 text-sm">{t('budget.noGiftOptions')}</div>
      ) : (
        <div className="space-y-4">
          {giftOptions.map((gift, index) => (
            <div
              key={index}
              className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">
                      {t('budget.giftTitle')}
                    </label>
                    <FormInput
                      value={gift.title}
                      onChange={(e) => updateGiftOption(index, 'title', e.target.value)}
                      placeholder={t('budget.placeholders.giftTitle')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">
                      {t('budget.giftDescription')}
                    </label>
                    <FormTextarea
                      value={gift.description}
                      onChange={(e) => updateGiftOption(index, 'description', e.target.value)}
                      placeholder={t('budget.placeholders.giftDescription')}
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">
                      {t('budget.giftImageUrl')}
                    </label>
                    <FormInput
                      value={gift.imageUrl || ''}
                      onChange={(e) => updateGiftOption(index, 'imageUrl', e.target.value)}
                      placeholder={t('budget.placeholders.giftImageUrl')}
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => removeGiftOption(index)}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  title={t('budget.removeGiftOption')}
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
