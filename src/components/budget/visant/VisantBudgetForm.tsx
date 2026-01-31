import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { FormInput } from '@/components/ui/form-input';
import { FormTextarea } from '@/components/ui/form-textarea';
import { DeliverablesSection } from '../DeliverablesSection';
import { PaymentInfoSection } from '../PaymentInfoSection';
import { SignaturesSection } from '../SignaturesSection';
import { DateRangePicker } from '../DateRangePicker';
import type { BudgetData } from '@/types/types';

interface VisantBudgetFormProps {
  data: BudgetData;
  onChange: (data: BudgetData) => void;
  budgetId?: string;
}

export const VisantBudgetForm: React.FC<VisantBudgetFormProps> = ({
  data,
  onChange,
  budgetId,
}) => {
  const { t } = useTranslation();

  const updateField = <K extends keyof BudgetData>(field: K, value: BudgetData[K]) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6 w-full h-full min-h-full">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-base sm:text-lg font-semibold text-neutral-200 font-mono">Informações Básicas</h3>

        <div className="w-full">
          <label className="block text-xs sm:text-sm text-neutral-400 mb-2 font-mono">
            {t('budget.clientName')} *
          </label>
          <FormInput
            value={data.clientName}
            onChange={(e) => updateField('clientName', e.target.value)}
            placeholder={t('budget.placeholders.clientName')}
            required
          />
        </div>

        <div className="w-full">
          <label className="block text-xs sm:text-sm text-neutral-400 mb-2 font-mono">
            {t('budget.projectName')} *
          </label>
          <FormInput
            value={data.projectName}
            onChange={(e) => updateField('projectName', e.target.value)}
            placeholder={t('budget.placeholders.projectName')}
            required
          />
        </div>

        <div className="w-full">
          <label className="block text-xs sm:text-sm text-neutral-400 mb-2 font-mono">
            {t('budget.projectDescription')} *
          </label>
          <FormTextarea
            value={data.projectDescription}
            onChange={(e) => updateField('projectDescription', e.target.value)}
            placeholder={t('budget.placeholders.projectDescription')}
            rows={4}
            required
          />
        </div>

        <DateRangePicker
          startDate={data.startDate}
          endDate={data.endDate}
          onStartDateChange={(date) => updateField('startDate', date)}
          onEndDateChange={(date) => updateField('endDate', date)}
        />

        <div className="w-full">
          <label className="block text-xs sm:text-sm text-neutral-400 mb-2 font-mono">
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
          <label className="block text-xs sm:text-sm text-neutral-400 mb-3 font-mono">
            Cores
          </label>
          <div className="grid grid-cols-2 gap-4">
            {/* Cor de Fundo da Capa */}
            <div>
              <label className="block text-xs text-neutral-500 mb-2 font-mono">
                Cor de Fundo da Capa
              </label>
              <div className="flex gap-2 items-center">
                <FormInput
                  type="color"
                  value={data.coverBackgroundColor || '#151515'}
                  onChange={(e) => updateField('coverBackgroundColor', e.target.value)}
                  className="w-10 h-10 cursor-pointer flex-shrink-0"
                />
                <FormInput
                  type="text"
                  value={data.coverBackgroundColor || '#151515'}
                  onChange={(e) => updateField('coverBackgroundColor', e.target.value)}
                  placeholder="#151515"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Cor do Texto da Capa */}
            <div>
              <label className="block text-xs text-neutral-500 mb-2 font-mono">
                Cor do Texto da Capa
              </label>
              <div className="flex gap-2 items-center">
                <FormInput
                  type="color"
                  value={data.coverTextColor || '#f9f9f9'}
                  onChange={(e) => updateField('coverTextColor', e.target.value)}
                  className="w-10 h-10 cursor-pointer flex-shrink-0"
                />
                <FormInput
                  type="text"
                  value={data.coverTextColor || '#f9f9f9'}
                  onChange={(e) => updateField('coverTextColor', e.target.value)}
                  placeholder="#f9f9f9"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Cor de Fundo */}
            <div>
              <label className="block text-xs text-neutral-500 mb-2 font-mono">
                {t('budget.brandBackgroundColor') || 'Cor de Fundo'}
              </label>
              <div className="flex gap-2 items-center">
                <FormInput
                  type="color"
                  value={data.brandBackgroundColor || '#000000'}
                  onChange={(e) => updateField('brandBackgroundColor', e.target.value || undefined)}
                  className="w-10 h-10 cursor-pointer flex-shrink-0"
                />
                <FormInput
                  type="text"
                  value={data.brandBackgroundColor || ''}
                  onChange={(e) => updateField('brandBackgroundColor', e.target.value || undefined)}
                  placeholder={t('budget.placeholders.brandBackgroundColor')}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Cor de Destaque */}
            <div>
              <label className="block text-xs text-neutral-500 mb-2 font-mono">
                {t('budget.brandAccentColor') || 'Cor de Destaque'}
              </label>
              <div className="flex gap-2 items-center">
                <FormInput
                  type="color"
                  value={data.brandAccentColor || 'brand-cyan'}
                  onChange={(e) => updateField('brandAccentColor', e.target.value || undefined)}
                  className="w-10 h-10 cursor-pointer flex-shrink-0"
                />
                <FormInput
                  type="text"
                  value={data.brandAccentColor || ''}
                  onChange={(e) => updateField('brandAccentColor', e.target.value || undefined)}
                  placeholder={t('budget.placeholders.brandAccentColor')}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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
        <label className="block text-xs sm:text-sm text-neutral-400 mb-2 font-mono">
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

