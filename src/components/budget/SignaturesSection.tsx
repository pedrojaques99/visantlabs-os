import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { FormInput } from '@/components/ui/form-input';
import type { Signature } from '@/types/types';
import { Plus, Trash2 } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';

interface SignaturesSectionProps {
  signatures: Signature[];
  onChange: (signatures: Signature[]) => void;
}

export const SignaturesSection: React.FC<SignaturesSectionProps> = ({ signatures, onChange }) => {
  const { t } = useTranslation();

  const addSignature = () => {
    onChange([...signatures, { name: '', role: '' }]);
  };

  const removeSignature = (index: number) => {
    onChange(signatures.filter((_, i) => i !== index));
  };

  const updateSignature = (index: number, field: keyof Signature, value: string) => {
    const updated = [...signatures];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-4 mb-[30px]">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">{t('budget.signatures')}</h3>
        <Button
          variant="brand"
          onClick={addSignature}
          className="p-2 bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700 rounded-xl text-foreground transition-colors duration-300 flex items-center justify-center"
          title={t('budget.addSignature')}
        >
          <Plus size={18} />
        </Button>
      </div>

      {signatures.length === 0 ? (
        <div className="text-center py-8 text-neutral-500 text-sm">{t('budget.noSignatures')}</div>
      ) : (
        <div className="space-y-4">
          {signatures.map((signature, index) => (
            <div
              key={index}
              className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">
                      {t('budget.signatureName')}
                    </label>
                    <FormInput
                      value={signature.name}
                      onChange={(e) => updateSignature(index, 'name', e.target.value)}
                      placeholder={t('budget.placeholders.signatureName')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">
                      {t('budget.signatureRole')}
                    </label>
                    <FormInput
                      value={signature.role}
                      onChange={(e) => updateSignature(index, 'role', e.target.value)}
                      placeholder={t('budget.placeholders.signatureRole')}
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => removeSignature(index)}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  title={t('budget.removeSignature')}
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
