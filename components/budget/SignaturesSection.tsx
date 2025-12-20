import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { FormInput } from '../ui/form-input';
import type { Signature } from '../../types';
import { Plus, Trash2 } from 'lucide-react';

interface SignaturesSectionProps {
  signatures: Signature[];
  onChange: (signatures: Signature[]) => void;
}

export const SignaturesSection: React.FC<SignaturesSectionProps> = ({
  signatures,
  onChange,
}) => {
  const { t } = useTranslation();

  const addSignature = () => {
    onChange([
      ...signatures,
      { name: '', role: '' },
    ]);
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
        <h3 className="text-lg font-semibold text-zinc-200 font-mono">
          {t('budget.signatures') || 'Assinaturas'}
        </h3>
        <button
          onClick={addSignature}
          className="p-2 bg-[#52ddeb]/20 hover:bg-[#52ddeb]/30 border border-[#52ddeb]/50 rounded-xl text-[#52ddeb] transition-all duration-300 flex items-center justify-center"
          title={t('budget.addSignature') || 'Adicionar Assinatura'}
        >
          <Plus size={18} />
        </button>
      </div>

      {signatures.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 font-mono text-sm">
          {t('budget.noSignatures') || 'Nenhuma assinatura adicionada ainda'}
        </div>
      ) : (
        <div className="space-y-4">
          {signatures.map((signature, index) => (
            <div
              key={index}
              className="p-4 bg-[#1A1A1A] border border-zinc-800 rounded-xl space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-mono">
                      {t('budget.signatureName') || 'Nome'}
                    </label>
                    <FormInput
                      value={signature.name}
                      onChange={(e) =>
                        updateSignature(index, 'name', e.target.value)
                      }
                      placeholder={t('budget.placeholders.signatureName') || 'Nome do signatário'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-mono">
                      {t('budget.signatureRole') || 'Cargo'}
                    </label>
                    <FormInput
                      value={signature.role}
                      onChange={(e) =>
                        updateSignature(index, 'role', e.target.value)
                      }
                      placeholder={t('budget.placeholders.signatureRole') || 'Cargo/Função'}
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeSignature(index)}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                  title={t('budget.removeSignature') || 'Remover assinatura'}
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

