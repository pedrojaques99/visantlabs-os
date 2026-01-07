import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { FormInput } from '../ui/form-input';
import { FormTextarea } from '../ui/form-textarea';
import type { FAQ } from '../../types';
import { Plus, Trash2 } from 'lucide-react';

interface FAQSectionProps {
  faq: FAQ[];
  onChange: (faq: FAQ[]) => void;
}

export const FAQSection: React.FC<FAQSectionProps> = ({
  faq,
  onChange,
}) => {
  const { t } = useTranslation();

  const addFAQ = () => {
    onChange([...faq, { question: '', answer: '' }]);
  };

  const removeFAQ = (index: number) => {
    onChange(faq.filter((_, i) => i !== index));
  };

  const updateFAQ = (index: number, field: keyof FAQ, value: string) => {
    const updated = [...faq];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-200 font-mono">
          {t('budget.faq')}
        </h3>
        <button
          onClick={addFAQ}
          className="px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[#brand-cyan]/50 rounded-xl text-brand-cyan font-mono text-sm transition-all duration-300 flex items-center gap-2"
        >
          <Plus size={16} />
          {t('budget.addFAQ')}
        </button>
      </div>

      {faq.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 font-mono text-sm">
          No FAQs added yet
        </div>
      ) : (
        <div className="space-y-4">
          {faq.map((item, index) => (
            <div
              key={index}
              className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3"
            >
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex-1 w-full space-y-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-mono">
                      {t('budget.question')}
                    </label>
                    <FormInput
                      value={item.question}
                      onChange={(e) =>
                        updateFAQ(index, 'question', e.target.value)
                      }
                      placeholder={t('budget.placeholders.question')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-mono">
                      {t('budget.answer')}
                    </label>
                    <FormTextarea
                      value={item.answer}
                      onChange={(e) =>
                        updateFAQ(index, 'answer', e.target.value)
                      }
                      placeholder={t('budget.placeholders.answer')}
                      rows={3}
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeFAQ(index)}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-md transition-colors self-start sm:self-auto"
                  title={t('budget.removeFAQ')}
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

