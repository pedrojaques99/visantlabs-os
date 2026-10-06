import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { FormInput } from '@/components/ui/form-input';
import { FormTextarea } from '@/components/ui/form-textarea';
import { DateRangePicker } from './DateRangePicker';
import type { BudgetData } from '@/types/types';

type FieldRefs = React.MutableRefObject<{
  [key: string]: HTMLInputElement | HTMLTextAreaElement | null;
}>;

interface BudgetBasicInfoFieldsProps {
  data: BudgetData;
  onFieldChange: <K extends keyof BudgetData>(field: K, value: BudgetData[K]) => void;
  /** Tipografia responsiva (formulário do template Visant). */
  responsive?: boolean;
  /** Refs + foco vindos do editor de PDF (formulário padrão). */
  fieldRefs?: FieldRefs;
  focusedFieldId?: string | null;
  /** Campos extras do template, renderizados depois das datas. */
  children?: React.ReactNode;
}

const FOCUS_RING = 'ring-2 ring-neutral-600 ring-offset-2 ring-offset-[#1A1A1A]';

/**
 * Informações básicas do orçamento (cliente, projeto, descrição, datas).
 * Compartilhado por BudgetForm e VisantBudgetForm.
 */
export const BudgetBasicInfoFields: React.FC<BudgetBasicInfoFieldsProps> = ({
  data,
  onFieldChange,
  responsive = false,
  fieldRefs,
  focusedFieldId,
  children,
}) => {
  const { t } = useTranslation();
  const labelCls = cn('block text-neutral-400 mb-2', responsive ? 'text-xs sm:text-sm' : 'text-xs');
  const wrapCls = responsive ? 'w-full' : undefined;
  const ref = (key: string) =>
    fieldRefs
      ? (el: HTMLInputElement | HTMLTextAreaElement | null) => {
          fieldRefs.current[key] = el;
        }
      : undefined;
  const focusCls = (key: string) => (focusedFieldId === key ? FOCUS_RING : '');

  return (
    <div className="space-y-4">
      <h3
        className={cn(
          'font-medium text-foreground',
          responsive ? 'text-base sm:text-lg' : 'text-lg'
        )}
      >
        {t('budget.basicInfo')}
      </h3>

      <div className={wrapCls}>
        <label className={labelCls}>{t('budget.clientName')} *</label>
        <FormInput
          ref={ref('clientName')}
          value={data.clientName}
          onChange={(e) => onFieldChange('clientName', e.target.value)}
          placeholder={t('budget.placeholders.clientName')}
          required
          className={focusCls('clientName')}
        />
      </div>

      <div className={wrapCls}>
        <label className={labelCls}>{t('budget.projectName')} *</label>
        <FormInput
          ref={ref('projectName')}
          value={data.projectName}
          onChange={(e) => onFieldChange('projectName', e.target.value)}
          placeholder={t('budget.placeholders.projectName')}
          required
          className={focusCls('projectName')}
        />
      </div>

      <div className={wrapCls}>
        <label className={labelCls}>{t('budget.projectDescription')} *</label>
        <FormTextarea
          ref={ref('projectDescription')}
          value={data.projectDescription}
          onChange={(e) => onFieldChange('projectDescription', e.target.value)}
          placeholder={t('budget.placeholders.projectDescription')}
          rows={4}
          required
          className={focusCls('projectDescription')}
        />
      </div>

      <DateRangePicker
        startDate={data.startDate}
        endDate={data.endDate}
        onStartDateChange={(date) => onFieldChange('startDate', date)}
        onEndDateChange={(date) => onFieldChange('endDate', date)}
      />

      {children}
    </div>
  );
};

interface BudgetColorFieldProps {
  label: string;
  value: string;
  /** Valor exibido no campo de texto (pode ser vazio quando não há cor definida). */
  textValue?: string;
  placeholder: string;
  onChange: (value: string) => void;
}

/** Seletor de cor + hex usado nas cores da marca do orçamento. */
export const BudgetColorField: React.FC<BudgetColorFieldProps> = ({
  label,
  value,
  textValue,
  placeholder,
  onChange,
}) => (
  <div>
    <label className="block text-xs text-neutral-500 mb-2">{label}</label>
    <div className="flex gap-2 items-center">
      <FormInput
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 cursor-pointer flex-shrink-0"
      />
      <FormInput
        type="text"
        value={textValue ?? value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
      />
    </div>
  </div>
);
