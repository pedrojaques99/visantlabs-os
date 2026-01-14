import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { FormInput } from '@/components/ui/form-input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Select } from '@/components/ui/select';
import type { PaymentInfo, PaymentMethod } from '@/types/types';
import { Plus, Trash2 } from 'lucide-react';

interface PaymentInfoSectionProps {
  paymentInfo: PaymentInfo;
  onChange: (paymentInfo: PaymentInfo) => void;
  currency?: 'BRL' | 'USD';
}

export const PaymentInfoSection: React.FC<PaymentInfoSectionProps> = ({
  paymentInfo,
  onChange,
  currency = 'BRL',
}) => {
  const { t } = useTranslation();
  const currencySymbol = currency === 'BRL' ? 'R$' : '$';

  // Adicionar método de pagamento padrão se estiver vazio
  React.useEffect(() => {
    if (paymentInfo.paymentMethods.length === 0) {
      onChange({
        ...paymentInfo,
        paymentMethods: [
          { type: 'pix' as const, label: 'PIX', description: 'À vista com desconto' },
        ],
      });
    }
  }, []);

  const updateField = <K extends keyof PaymentInfo>(field: K, value: PaymentInfo[K]) => {
    onChange({ ...paymentInfo, [field]: value });
  };

  const addPaymentMethod = () => {
    const newMethods = [
      ...paymentInfo.paymentMethods,
      { type: 'pix' as const, label: '', description: '' },
    ];
    updateField('paymentMethods', newMethods);
  };

  const removePaymentMethod = (index: number) => {
    const newMethods = paymentInfo.paymentMethods.filter((_, i) => i !== index);
    updateField('paymentMethods', newMethods);
  };

  const updatePaymentMethod = (index: number, field: keyof PaymentMethod, value: any) => {
    const updated = [...paymentInfo.paymentMethods];
    updated[index] = { ...updated[index], [field]: value };
    updateField('paymentMethods', updated);
  };

  const calculateCashDiscount = (): number => {
    if (!paymentInfo.totalHours || !paymentInfo.hourlyRate || !paymentInfo.cashDiscountPercent) {
      return 0;
    }
    const total = paymentInfo.totalHours * paymentInfo.hourlyRate;
    return total * (paymentInfo.cashDiscountPercent / 100);
  };

  const calculateTotalWithDiscount = (): number => {
    if (!paymentInfo.totalHours || !paymentInfo.hourlyRate) {
      return 0;
    }
    const total = paymentInfo.totalHours * paymentInfo.hourlyRate;
    return total - calculateCashDiscount();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-neutral-200 font-mono">
        {t('budget.paymentInfo') || 'Informações de Pagamento'}
      </h3>

      <div className="space-y-4 p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-2 font-mono">
              {t('budget.totalHours') || 'Total de Horas'}
            </label>
            <FormInput
              type="number"
              min="0"
              step="0.5"
              value={paymentInfo.totalHours || ''}
              onChange={(e) =>
                updateField('totalHours', parseFloat(e.target.value) || 0)
              }
              placeholder="30"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-2 font-mono">
              {t('budget.hourlyRate') || 'Valor por Hora'}
            </label>
            <CurrencyInput
              value={paymentInfo.hourlyRate || 0}
              onChange={(value) => updateField('hourlyRate', value)}
              currency={currency}
              placeholder="258,00"
            />
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-[2] w-full">
            <label className="block text-xs text-neutral-400 mb-2 font-mono">
              {t('budget.pixKey') || 'Chave PIX'}
            </label>
            <FormInput
              value={paymentInfo.pixKey || ''}
              onChange={(e) => updateField('pixKey', e.target.value)}
              placeholder="29673608000169"
              className="w-full"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs text-neutral-400 mb-2 font-mono">
              {t('budget.cashDiscountPercent') || 'Desconto à Vista (%)'}
            </label>
            <FormInput
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={paymentInfo.cashDiscountPercent || ''}
              onChange={(e) =>
                updateField('cashDiscountPercent', parseFloat(e.target.value) || 0)
              }
              placeholder="8"
              className="w-full"
            />
          </div>
        </div>

        {(paymentInfo.totalHours && paymentInfo.hourlyRate) && (
          <div className="pt-3 border-t border-neutral-800/50 space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-neutral-500">
                {paymentInfo.totalHours}h × R${paymentInfo.hourlyRate}/h:
              </span>
              <span className="text-neutral-400">
                R$ {(paymentInfo.totalHours * paymentInfo.hourlyRate).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            {paymentInfo.cashDiscountPercent && (
              <>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-500">
                    Desconto ({paymentInfo.cashDiscountPercent}%):
                  </span>
                  <span className="text-neutral-500">
                    - R$ {calculateCashDiscount().toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-mono border-t border-neutral-800/30 pt-1.5">
                  <span className="text-neutral-400">Total com Desconto:</span>
                  <span className="text-neutral-300">
                    R$ {calculateTotalWithDiscount().toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h4 className="text-md font-semibold text-neutral-200 font-mono">
          {t('budget.paymentMethods') || 'Métodos de Pagamento'}
        </h4>

        {paymentInfo.paymentMethods.length === 0 ? (
          <div className="text-center py-4 text-neutral-500 font-mono text-sm">
            {t('budget.noPaymentMethods') || 'Nenhum método de pagamento adicionado'}
          </div>
        ) : (
          <div className="space-y-3">
            {paymentInfo.paymentMethods.map((method, index) => (
              <div key={index}>
                <div
                  className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 w-full space-y-3">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1 font-mono">
                          {t('budget.methodType') || 'Tipo'}
                        </label>
                        <Select
                          value={method.type}
                          onChange={(value) =>
                            updatePaymentMethod(
                              index,
                              'type',
                              value as 'pix' | 'credit' | 'crypto'
                            )
                          }
                          options={[
                            { value: 'pix', label: 'PIX' },
                            { value: 'credit', label: 'Cartão de Crédito' },
                            { value: 'crypto', label: 'Crypto' },
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1 font-mono">
                          {t('budget.methodLabel') || 'Label'}
                        </label>
                        <FormInput
                          value={method.label}
                          onChange={(e) =>
                            updatePaymentMethod(index, 'label', e.target.value)
                          }
                          placeholder="PIX"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1 font-mono">
                          {t('budget.methodDescription') || 'Descrição'}
                        </label>
                        <FormInput
                          value={method.description}
                          onChange={(e) =>
                            updatePaymentMethod(index, 'description', e.target.value)
                          }
                          placeholder="À vista com 5% de desconto"
                        />
                      </div>
                      {method.type === 'credit' && (
                        <div>
                          <label className="block text-xs text-neutral-400 mb-1 font-mono">
                            {t('budget.installments') || 'Parcelas'}
                          </label>
                          <FormInput
                            type="number"
                            min="1"
                            value={method.installments || ''}
                            onChange={(e) =>
                              updatePaymentMethod(
                                index,
                                'installments',
                                parseInt(e.target.value) || 1
                              )
                            }
                            placeholder="10"
                          />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removePaymentMethod(index)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-md transition-colors self-start sm:self-auto"
                      title={t('budget.removePaymentMethod') || 'Remover método'}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                {index === paymentInfo.paymentMethods.length - 1 && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={addPaymentMethod}
                      className="flex items-center justify-center p-1.5 bg-black/30 hover:bg-black/50 border border-neutral-700/30 hover:border-neutral-600/50 rounded-md text-neutral-400 hover:text-neutral-300 transition-all duration-200"
                      title={t('budget.addPaymentMethod') || 'Adicionar Método'}
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
    </div>
  );
};

