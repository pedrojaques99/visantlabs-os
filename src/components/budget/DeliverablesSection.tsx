import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { FormInput } from '@/components/ui/form-input';
import { FormTextarea } from '@/components/ui/form-textarea';
import type { Deliverable } from '@/types/types';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliverablesSectionProps {
  deliverables: Deliverable[];
  onChange: (deliverables: Deliverable[]) => void;
  currency?: 'BRL' | 'USD';
  onCurrencyChange?: (currency: 'BRL' | 'USD') => void;
}

export const DeliverablesSection: React.FC<DeliverablesSectionProps> = ({
  deliverables,
  onChange,
  currency = 'BRL',
  onCurrencyChange,
}) => {
  const { t } = useTranslation();

  // Adicionar deliverable padrão se estiver vazio
  React.useEffect(() => {
    if (deliverables.length === 0) {
      onChange([
        { name: 'Design de Website', description: '', quantity: 1, unitValue: 0 },
      ]);
    }
  }, []);

  const addDeliverable = () => {
    onChange([
      ...deliverables,
      { name: '', description: '', quantity: 1, unitValue: 0 },
    ]);
  };

  const removeDeliverable = (index: number) => {
    onChange(deliverables.filter((_, i) => i !== index));
  };

  const updateDeliverable = (index: number, field: keyof Deliverable, value: any) => {
    const updated = [...deliverables];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-200 font-mono">
          {t('budget.deliverables')}
        </h3>
        <button
          onClick={addDeliverable}
          className="p-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/50 rounded-xl text-brand-cyan transition-all duration-300 flex items-center justify-center"
          title={t('budget.addDeliverable') || 'Adicionar Entregável'}
        >
          <Plus size={18} />
        </button>
      </div>

      {deliverables.length === 0 ? (
        <div className="text-center py-8 text-neutral-500 font-mono text-sm">
          {t('budget.placeholders.deliverableName')}
        </div>
      ) : (
        <div className="space-y-4">
          {deliverables.map((deliverable, index) => (
            <div key={index}>
              <div
                className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3"
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex-1 w-full space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1 font-mono">
                          {t('budget.deliverableName')}
                        </label>
                        <FormInput
                          value={deliverable.name}
                          onChange={(e) =>
                            updateDeliverable(index, 'name', e.target.value)
                          }
                          placeholder={t('budget.placeholders.deliverableName')}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1 font-mono">
                          {t('budget.deliverableDescription')}
                        </label>
                        <FormInput
                          value={deliverable.description}
                          onChange={(e) =>
                            updateDeliverable(index, 'description', e.target.value)
                          }
                          placeholder={t('budget.placeholders.deliverableDescription')}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1 font-mono">
                          {t('budget.quantity')}
                        </label>
                        <FormInput
                          type="number"
                          min="1"
                          value={deliverable.quantity}
                          onChange={(e) =>
                            updateDeliverable(
                              index,
                              'quantity',
                              parseInt(e.target.value) || 1
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDeliverable(index)}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-md transition-colors self-start sm:self-auto"
                    title={t('budget.removeDeliverable')}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              {index === deliverables.length - 1 && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={addDeliverable}
                    className="flex items-center justify-center p-1.5 bg-neutral-950/30 hover:bg-neutral-950/50 border border-neutral-700/30 hover:border-neutral-600/50 rounded-md text-neutral-400 hover:text-neutral-300 transition-all duration-200"
                    title={t('budget.addDeliverable') || 'Adicionar Entregável'}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

