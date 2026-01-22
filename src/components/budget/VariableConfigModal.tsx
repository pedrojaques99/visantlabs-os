import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FormInput } from '@/components/ui/form-input';
import type { BudgetData } from '@/types/types';

interface VariableConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  fieldId: string;
  label: string;
  data: BudgetData;
  currentValue?: string;
  onConfirm: (customValue?: string) => void;
}

// Helper to get default value from BudgetData
const getDefaultValue = (data: BudgetData, fieldId: string): string => {
  switch (fieldId) {
    case 'clientName':
      return data.clientName;
    case 'projectName':
      return data.projectName;
    case 'projectDescription':
      return data.projectDescription;
    case 'brandName':
      return data.brandName;
    case 'startDate':
      return new Date(data.startDate).toLocaleDateString('pt-BR');
    case 'endDate':
      return new Date(data.endDate).toLocaleDateString('pt-BR');
    case 'year':
      return data.year || new Date().getFullYear().toString();
    case 'observations':
      return data.observations || '';
    case 'finalCTAText':
      return data.finalCTAText || '';
    default:
      return '';
  }
};

export const VariableConfigModal: React.FC<VariableConfigModalProps> = ({
  isOpen,
  onClose,
  fieldId,
  label,
  data,
  currentValue,
  onConfirm,
}) => {
  const [customValue, setCustomValue] = useState(currentValue || '');
  const defaultValue = getDefaultValue(data, fieldId);
  const isCustomField = fieldId.startsWith('custom_');
  const isCurrencyField = fieldId === 'custom_currency';
  const showCustomInput = isCustomField || !defaultValue || defaultValue.trim() === '';

  useEffect(() => {
    if (isOpen) {
      setCustomValue(currentValue || defaultValue);
    }
  }, [isOpen, currentValue, defaultValue]);

  if (!isOpen) return null;

  const formatCurrencyDisplay = (value: string): string => {
    if (!value) return '';
    // Remove tudo exceto números e vírgula/ponto
    const cleaned = value.replace(/[^\d,.-]/g, '');
    // Substitui vírgula por ponto para processamento
    const normalized = cleaned.replace(',', '.');
    // Tenta converter para número
    const num = parseFloat(normalized);
    if (isNaN(num)) return cleaned;
    // Formata como moeda brasileira para exibição
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrencyValue = (value: string): string => {
    if (!value) return '';
    // Remove formatação e converte para número
    const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return '';
    return num.toString();
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permite apenas números, vírgula e ponto
    if (/^[\d,.\s]*$/.test(value) || value === '') {
      setCustomValue(value);
    }
  };

  const handleConfirm = () => {
    if (showCustomInput && !customValue.trim()) {
      return;
    }
    // Para campo de moeda, salva o valor numérico
    const valueToSave = isCurrencyField && customValue.trim()
      ? parseCurrencyValue(customValue)
      : customValue;
    onConfirm(showCustomInput ? valueToSave : undefined);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Handle ESC key at document level
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold font-mono text-neutral-200">
            {label}
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Preview do valor atual */}
          {!showCustomInput && defaultValue && (
            <div>
              <label className="block text-xs text-neutral-400 mb-2 font-mono">
                Valor Atual
              </label>
              <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-md text-sm text-neutral-300 font-mono">
                {defaultValue}
              </div>
            </div>
          )}

          {/* Input para valor customizado */}
          {showCustomInput && (
            <div>
              <label className="block text-xs text-neutral-400 mb-2 font-mono">
                {isCurrencyField ? 'Valor (R$)' : 'Valor'}
              </label>
              <FormInput
                type="text"
                value={customValue}
                onChange={isCurrencyField ? handleCurrencyChange : (e) => setCustomValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isCurrencyField ? 'Digite o valor (ex: 1500,00 ou 1500.00)' : 'Digite o valor...'}
                className="w-full"
                autoFocus
              />
              {isCurrencyField && customValue && (
                <p className="text-xs text-neutral-500 font-mono mt-1">
                  Preview: R$ {formatCurrencyDisplay(customValue)}
                </p>
              )}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-neutral-300 font-mono text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={showCustomInput && !customValue.trim()}
              className="flex-1 px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/50 rounded-md text-brand-cyan font-mono text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              OK - Posicionar no PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

