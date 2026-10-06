import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { FormInput } from '@/components/ui/form-input';
import { FormTextarea } from '@/components/ui/form-textarea';
import { DeliverablesSection } from '../DeliverablesSection';
import { PaymentInfoSection } from '../PaymentInfoSection';
import { SignaturesSection } from '../SignaturesSection';
import { BudgetBasicInfoFields, BudgetColorField } from '../BudgetBasicInfoFields';
import type { BudgetData } from '@/types/types';

import { DEFAULT_DOCUMENT_ACCENT } from './documentColors';
interface VisantBudgetFormProps {
  data: BudgetData;
  onChange: (data: BudgetData) => void;
  budgetId?: string;
}

export const VisantBudgetForm: React.FC<VisantBudgetFormProps> = ({ data, onChange, budgetId }) => {
  const { t } = useTranslation();

  const updateField = <K extends keyof BudgetData>(field: K, value: BudgetData[K]) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6 w-full h-full min-h-full">
      <BudgetBasicInfoFields data={data} onFieldChange={updateField} responsive>
        <div className="w-full">
          <label className="block text-xs sm:text-sm text-neutral-400 mb-2">
            Título do Serviço (Capa)
          </label>
          <FormInput
            value={data.serviceTitle || 'BRANDING COMPLETO'}
            onChange={(e) => updateField('serviceTitle', e.target.value)}
            placeholder="BRANDING COMPLETO"
          />
        </div>

        {/* Cores - Grid 2x2 */}
        <div className="w-full">
          <label className="block text-xs sm:text-sm text-neutral-400 mb-3">Cores</label>
          <div className="grid grid-cols-2 gap-4">
            <BudgetColorField
              label="Cor de Fundo da Capa"
              value={data.coverBackgroundColor || '#151515'}
              placeholder="#151515"
              onChange={(v) => updateField('coverBackgroundColor', v)}
            />
            <BudgetColorField
              label="Cor do Texto da Capa"
              value={data.coverTextColor || '#f9f9f9'}
              placeholder="#f9f9f9"
              onChange={(v) => updateField('coverTextColor', v)}
            />
            <BudgetColorField
              label={t('budget.brandBackgroundColor')}
              value={data.brandBackgroundColor || '#000000'}
              textValue={data.brandBackgroundColor || ''}
              placeholder={t('budget.placeholders.brandBackgroundColor')}
              onChange={(v) => updateField('brandBackgroundColor', v || undefined)}
            />
            <BudgetColorField
              label={t('budget.brandAccentColor')}
              value={data.brandAccentColor || DEFAULT_DOCUMENT_ACCENT}
              textValue={data.brandAccentColor || ''}
              placeholder={t('budget.placeholders.brandAccentColor')}
              onChange={(v) => updateField('brandAccentColor', v || undefined)}
            />
          </div>
        </div>
      </BudgetBasicInfoFields>

      {/* Deliverables */}
      <DeliverablesSection
        deliverables={data.deliverables}
        onChange={(deliverables) => updateField('deliverables', deliverables)}
        currency={data.currency || 'BRL'}
        onCurrencyChange={(currency) => updateField('currency', currency)}
      />

      {/* Payment Info */}
      <PaymentInfoSection
        paymentInfo={data.paymentInfo || { paymentMethods: [] }}
        onChange={(paymentInfo) => updateField('paymentInfo', paymentInfo)}
        currency={data.currency || 'BRL'}
      />

      {/* Observations */}
      <div className="w-full">
        <label className="block text-xs sm:text-sm text-neutral-400 mb-2">
          {t('budget.observations')}
        </label>
        <FormTextarea
          value={data.observations || ''}
          onChange={(e) => updateField('observations', e.target.value)}
          placeholder={t('budget.placeholders.observations')}
          rows={4}
        />
      </div>

      {/* Signatures */}
      <SignaturesSection
        signatures={data.signatures || []}
        onChange={(signatures) => updateField('signatures', signatures)}
      />
    </div>
  );
};
