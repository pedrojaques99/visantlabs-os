import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { FormInput } from '../ui/form-input';
import { FormTextarea } from '../ui/form-textarea';
import { DeliverablesSection } from './DeliverablesSection';
import { LinksSection } from './LinksSection';
import { FAQSection } from './FAQSection';
import { DateRangePicker } from './DateRangePicker';
import { TimelineSection } from './TimelineSection';
import { PaymentInfoSection } from './PaymentInfoSection';
import { SignaturesSection } from './SignaturesSection';
import { GiftOptionsSection } from './GiftOptionsSection';
import { CustomContentSection } from './CustomContentSection';
import { VisantBudgetForm } from './visant/VisantBudgetForm';
import { PdfUploadSection } from './PdfUploadSection';
import { PdfFieldEditor } from './PdfFieldEditor';
import type { BudgetData } from '../../types';

interface BudgetFormProps {
  data: BudgetData;
  onChange: (data: BudgetData) => void;
  budgetId?: string;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  positioningFieldId?: string | null;
  onPositioningModeChange?: (fieldId: string | null) => void;
  pendingFieldPosition?: { pageNum: number; x: number; y: number } | null;
  onFieldFromFormClick?: (fieldId: string) => void;
  focusedFieldId?: string | null;
  onFocusedFieldChange?: (fieldId: string | null) => void;
  onFieldFilled?: (fieldId: string) => void;
}

export const BudgetForm: React.FC<BudgetFormProps> = ({
  data,
  onChange,
  budgetId,
  currentPage = 1,
  onPageChange,
  positioningFieldId,
  onPositioningModeChange,
  pendingFieldPosition,
  onFieldFromFormClick,
  focusedFieldId,
  onFocusedFieldChange,
  onFieldFilled,
}) => {
  const { t } = useTranslation();
  const fieldRefs = React.useRef<{ [key: string]: HTMLInputElement | HTMLTextAreaElement | null }>({});

  // Focus and scroll to field when focusedFieldId changes
  React.useEffect(() => {
    if (focusedFieldId) {
      const fieldElement = fieldRefs.current[focusedFieldId];
      if (fieldElement) {
        // Scroll to field
        fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Focus after a small delay to ensure scroll completes
        setTimeout(() => {
          fieldElement.focus();
        }, 300);
      }
    }
  }, [focusedFieldId]);

  // Check if field was filled and trigger callback
  React.useEffect(() => {
    if (!focusedFieldId || !onFieldFilled) return;

    const checkFieldValue = () => {
      let hasValue = false;
      switch (focusedFieldId) {
        case 'clientName':
          hasValue = !!data.clientName && data.clientName.trim() !== '';
          break;
        case 'projectName':
          hasValue = !!data.projectName && data.projectName.trim() !== '';
          break;
        case 'projectDescription':
          hasValue = !!data.projectDescription && data.projectDescription.trim() !== '';
          break;
        case 'brandName':
          hasValue = !!data.brandName && data.brandName.trim() !== '';
          break;
        case 'year':
          hasValue = !!data.year && data.year.trim() !== '';
          break;
        case 'observations':
          hasValue = !!data.observations && data.observations.trim() !== '';
          break;
        case 'finalCTAText':
          hasValue = !!data.finalCTAText && data.finalCTAText.trim() !== '';
          break;
      }

      if (hasValue && onFieldFilled) {
        onFieldFilled(focusedFieldId);
        if (onFocusedFieldChange) {
          onFocusedFieldChange(null);
        }
      }
    };

    // Check immediately and after a delay
    checkFieldValue();
    const interval = setInterval(checkFieldValue, 500);
    return () => clearInterval(interval);
  }, [focusedFieldId, data, onFieldFilled, onFocusedFieldChange]);

  // Se for template visant, usar VisantBudgetForm
  if (data.template === 'visant') {
    return (
      <VisantBudgetForm
        data={data}
        onChange={onChange}
        budgetId={budgetId}
      />
    );
  }

  const updateField = <K extends keyof BudgetData>(field: K, value: BudgetData[K]) => {
    onChange({ ...data, [field]: value });
  };

  // Se for template custom, mostrar apenas a seção de PDF
  if (data.template === 'custom') {
    return (
      <div className="space-y-6">
        {/* Custom PDF Section */}
        <div className="space-y-6 rounded-xl p-4 sm:p-6 bg-zinc-900 border border-zinc-800">
          <PdfUploadSection
            customPdfUrl={data.customPdfUrl}
            budgetId={budgetId}
            onPdfUrlChange={(url) => updateField('customPdfUrl', url)}
          />

          {data.customPdfUrl && (
            <PdfFieldEditor
              fieldMappings={data.pdfFieldMappings || []}
              onFieldMappingsChange={(mappings) => updateField('pdfFieldMappings', mappings)}
              onPositioningModeChange={onPositioningModeChange}
              positioningFieldId={positioningFieldId || null}
              data={data}
              onFocusFormField={onFocusedFieldChange ? (fieldId) => onFocusedFieldChange(fieldId) : undefined}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-zinc-200 font-mono">Informações Básicas</h3>

        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-mono">
            {t('budget.clientName')} *
          </label>
          <FormInput
            ref={(el) => { fieldRefs.current['clientName'] = el; }}
            value={data.clientName}
            onChange={(e) => updateField('clientName', e.target.value)}
            placeholder={t('budget.placeholders.clientName')}
            required
            className={focusedFieldId === 'clientName' ? 'ring-2 ring-[#brand-cyan] ring-offset-2 ring-offset-[#1A1A1A]' : ''}
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-mono">
            {t('budget.projectName')} *
          </label>
          <FormInput
            ref={(el) => { fieldRefs.current['projectName'] = el; }}
            value={data.projectName}
            onChange={(e) => updateField('projectName', e.target.value)}
            placeholder={t('budget.placeholders.projectName')}
            required
            className={focusedFieldId === 'projectName' ? 'ring-2 ring-[#brand-cyan] ring-offset-2 ring-offset-[#1A1A1A]' : ''}
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-mono">
            {t('budget.projectDescription')} *
          </label>
          <FormTextarea
            ref={(el) => { fieldRefs.current['projectDescription'] = el; }}
            value={data.projectDescription}
            onChange={(e) => updateField('projectDescription', e.target.value)}
            placeholder={t('budget.placeholders.projectDescription')}
            rows={4}
            required
            className={focusedFieldId === 'projectDescription' ? 'ring-2 ring-[#brand-cyan] ring-offset-2 ring-offset-[#1A1A1A]' : ''}
          />
        </div>

        <DateRangePicker
          startDate={data.startDate}
          endDate={data.endDate}
          onStartDateChange={(date) => updateField('startDate', date)}
          onEndDateChange={(date) => updateField('endDate', date)}
        />
      </div>

      {/* Deliverables */}
      <DeliverablesSection
        deliverables={data.deliverables}
        onChange={(deliverables) => updateField('deliverables', deliverables)}
        currency={data.currency || 'BRL'}
        onCurrencyChange={(currency) => updateField('currency', currency)}
      />

      {/* Observations */}
      <div>
        <label className="block text-xs text-zinc-400 mb-2 font-mono">
          {t('budget.observations')}
        </label>
        <FormTextarea
          ref={(el) => { fieldRefs.current['observations'] = el; }}
          value={data.observations || ''}
          onChange={(e) => updateField('observations', e.target.value)}
          placeholder={t('budget.placeholders.observations')}
          rows={4}
          className={focusedFieldId === 'observations' ? 'ring-2 ring-[#brand-cyan] ring-offset-2 ring-offset-[#1A1A1A]' : ''}
        />
      </div>

      {/* Links */}
      <LinksSection
        links={data.links}
        onChange={(links) => updateField('links', links)}
      />

      {/* FAQ */}
      <FAQSection
        faq={data.faq}
        onChange={(faq) => updateField('faq', faq)}
      />

      {/* Custom PDF Section */}
      <div className="space-y-6 rounded-xl p-6 bg-zinc-900 border border-zinc-800">
        <PdfUploadSection
          customPdfUrl={data.customPdfUrl}
          budgetId={budgetId}
          onPdfUrlChange={(url) => updateField('customPdfUrl', url)}
        />

        {data.customPdfUrl && (
          <PdfFieldEditor
            fieldMappings={data.pdfFieldMappings || []}
            onFieldMappingsChange={(mappings) => updateField('pdfFieldMappings', mappings)}
            onPositioningModeChange={onPositioningModeChange}
            positioningFieldId={positioningFieldId || null}
            data={data}
            onFocusFormField={onFocusedFieldChange ? (fieldId) => onFocusedFieldChange(fieldId) : undefined}
          />
        )}
      </div>
    </div>
  );
};

