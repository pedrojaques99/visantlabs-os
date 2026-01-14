import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import type { BudgetData, Deliverable, FAQ, BudgetLinks } from '@/types/types';
import { Calendar, Globe, Instagram, MessageCircle } from 'lucide-react';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { PdfPreviewWithFields } from './PdfPreviewWithFields';
import { VisantBudgetPage } from './visant/VisantBudgetPage';
import { VisantCoverPage } from './visant/VisantCoverPage';
import { VisantIntroductionPage } from './visant/VisantIntroductionPage';
import { VisantTimelinePage } from './visant/VisantTimelinePage';
import { VisantGiftsPage } from './visant/VisantGiftsPage';
import { VisantPaymentPage } from './visant/VisantPaymentPage';
import { VisantBackCoverPage } from './visant/VisantBackCoverPage';
import { ResponsivePageWrapper } from './visant/ResponsivePageWrapper';
import { VisantPageRenderer } from './visant/VisantPageRenderer';
import { useVisantTemplate } from '@/hooks/useVisantTemplate';

interface BudgetPreviewProps {
  data: BudgetData;
  currentPage?: number;
  viewMode?: 'current' | 'all';
  onPageChange?: (page: number) => void;
  onViewModeChange?: (mode: 'current' | 'all') => void;
  editable?: boolean;
  onDataChange?: (data: Partial<BudgetData>) => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  positioningFieldId?: string | null;
  onPositioningModeChange?: (fieldId: string | null) => void;
  onFieldSelect?: (fieldId: string | null) => void;
  selectedFieldId?: string | null;
  pendingFieldPosition?: { pageNum: number; x: number; y: number } | null;
  onPendingFieldPositionChange?: (position: { pageNum: number; x: number; y: number } | null) => void;
  onAddFieldFromForm?: (fieldId: string) => void;
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragCancel?: () => void;
  activeId?: string | null;
  budgetId?: string | null;
  isSidebarOpen?: boolean;
}

// Component to render Visant preview (with or without custom template)
const VisantPreviewContent: React.FC<{ data: BudgetData; editable?: boolean; onDataChange?: (data: Partial<BudgetData>) => void; saveStatus?: 'idle' | 'saving' | 'saved' | 'error'; budgetId?: string | null; isSidebarOpen?: boolean }> = ({
  data,
  editable = false,
  onDataChange,
  saveStatus = 'idle',
  budgetId,
  isSidebarOpen = false,
}) => {
  const { activeTemplate, isLoading } = useVisantTemplate();
  const { theme } = useTheme();

  // If loading or no custom template, use default components
  if (isLoading || !activeTemplate) {
    return (
      <div className={`w-full h-full min-h-full flex flex-col ${theme === 'dark' ? 'bg-[#0C0C0C]' : 'bg-neutral-100'}`}>
        <div className="flex-1 min-h-full overflow-visible">
          {/* Page 1: Cover */}
          <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="cover" budgetData={data} isSidebarOpen={isSidebarOpen}>
            <VisantCoverPage
              data={data}
              editable={editable}
              onDataChange={onDataChange}
            />
          </ResponsivePageWrapper>
          {/* Page 2: Timeline */}
          <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="timeline" budgetData={data} isSidebarOpen={isSidebarOpen}>
            <VisantTimelinePage
              data={data}
              editable={editable}
              onDataChange={onDataChange}
            />
          </ResponsivePageWrapper>
          {/* Page 3: Introduction */}
          <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="introduction" budgetData={data} isSidebarOpen={isSidebarOpen}>
            <VisantIntroductionPage
              data={data}
              editable={editable}
              onDataChange={onDataChange}
            />
          </ResponsivePageWrapper>
          {/* Page 4: Budget */}
          <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="budget" budgetData={data} isSidebarOpen={isSidebarOpen}>
            <VisantBudgetPage
              data={data}
              editable={editable}
              onDataChange={onDataChange}
              saveStatus={saveStatus}
            />
          </ResponsivePageWrapper>
          {/* Page 5: Gifts */}
          <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="gifts" budgetData={data} isSidebarOpen={isSidebarOpen}>
            <VisantGiftsPage
              data={data}
              editable={editable}
              onDataChange={onDataChange}
              budgetId={budgetId || undefined}
            />
          </ResponsivePageWrapper>
          {/* Page 6: Payment */}
          <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="payment" budgetData={data} isSidebarOpen={isSidebarOpen}>
            <VisantPaymentPage
              data={data}
              editable={editable}
              onDataChange={onDataChange}
            />
          </ResponsivePageWrapper>
          {/* Page 7: Back Cover */}
          <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="backCover" budgetData={data} isSidebarOpen={isSidebarOpen}>
            <VisantBackCoverPage
              data={data}
              editable={editable}
              onDataChange={onDataChange}
            />
          </ResponsivePageWrapper>
        </div>
      </div>
    );
  }

  // Use custom template layout
  return (
    <div className={`w-full h-full min-h-full flex flex-col ${theme === 'dark' ? 'bg-[#0C0C0C]' : 'bg-neutral-100'}`}>
      <div className="flex-1 min-h-full overflow-visible">
        {/* Page 1: Cover */}
        <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="cover" budgetData={data} isSidebarOpen={isSidebarOpen}>
          <VisantPageRenderer
            data={data}
            layout={activeTemplate.layout}
            pageName="cover"
            editable={editable}
            onDataChange={onDataChange}
          />
        </ResponsivePageWrapper>
        {/* Page 2: Timeline */}
        <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="timeline" budgetData={data} isSidebarOpen={isSidebarOpen}>
          <VisantTimelinePage
            data={data}
            editable={editable}
            onDataChange={onDataChange}
          />
        </ResponsivePageWrapper>
        {/* Page 3: Introduction */}
        <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="introduction" budgetData={data} isSidebarOpen={isSidebarOpen}>
          <VisantPageRenderer
            data={data}
            layout={activeTemplate.layout}
            pageName="introduction"
            editable={editable}
            onDataChange={onDataChange}
          />
        </ResponsivePageWrapper>
        {/* Page 4: Budget */}
        <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="budget" budgetData={data} isSidebarOpen={isSidebarOpen}>
          <VisantPageRenderer
            data={data}
            layout={activeTemplate.layout}
            pageName="budget"
            editable={editable}
            onDataChange={onDataChange}
          />
        </ResponsivePageWrapper>
        {/* Page 5: Gifts */}
        <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="gifts" budgetData={data} isSidebarOpen={isSidebarOpen}>
          <VisantPageRenderer
            data={data}
            layout={activeTemplate.layout}
            pageName="gifts"
            editable={editable}
            onDataChange={onDataChange}
          />
        </ResponsivePageWrapper>
        {/* Page 6: Payment */}
        <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="payment" budgetData={data} isSidebarOpen={isSidebarOpen}>
          <VisantPageRenderer
            data={data}
            layout={activeTemplate.layout}
            pageName="payment"
            editable={editable}
            onDataChange={onDataChange}
          />
        </ResponsivePageWrapper>
        {/* Page 7: Back Cover */}
        <ResponsivePageWrapper contentWidth={data.contentWidth} pageName="backCover" budgetData={data} isSidebarOpen={isSidebarOpen}>
          <VisantPageRenderer
            data={data}
            layout={activeTemplate.layout}
            pageName="backCover"
            editable={editable}
            onDataChange={onDataChange}
          />
        </ResponsivePageWrapper>
      </div>
    </div>
  );
};

export const BudgetPreview: React.FC<BudgetPreviewProps> = ({
  data,
  currentPage = 1,
  viewMode = 'all',
  onPageChange,
  onViewModeChange,
  editable = false,
  onDataChange,
  saveStatus = 'idle',
  positioningFieldId,
  onPositioningModeChange,
  onFieldSelect,
  selectedFieldId,
  pendingFieldPosition,
  onPendingFieldPositionChange,
  onAddFieldFromForm,
  onDragStart,
  onDragEnd,
  onDragCancel,
  activeId,
  budgetId,
  isSidebarOpen = false,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  // If custom PDF is provided, show it instead
  if (data.customPdfUrl) {
    return (
      <div className={`w-full h-full min-h-full flex flex-col ${theme === 'dark' ? 'bg-[#0C0C0C]' : 'bg-neutral-100'}`}>
        <PdfPreviewWithFields
          pdfUrl={data.customPdfUrl}
          data={data}
          fieldMappings={data.pdfFieldMappings || []}
          onFieldMappingsChange={(mappings) => onDataChange?.({ pdfFieldMappings: mappings })}
          editable={editable}
          positioningFieldId={positioningFieldId}
          onPositioningModeChange={onPositioningModeChange}
          onFieldSelect={onFieldSelect}
          selectedFieldId={selectedFieldId}
          pendingFieldPosition={pendingFieldPosition}
          onPendingFieldPositionChange={onPendingFieldPositionChange}
          onAddFieldFromForm={onAddFieldFromForm}
          externalOnDragStart={onDragStart}
          externalOnDragEnd={onDragEnd}
          externalActiveId={activeId}
        />
      </div>
    );
  }

  // If template is custom but no PDF uploaded yet
  if (data.template === 'custom') {
    return (
      <div className={`w-full h-full min-h-full flex items-center justify-center ${theme === 'dark' ? 'bg-[#0C0C0C]' : 'bg-neutral-100'}`}>
        <div className="text-center p-8">
          <p className={`text-lg font-mono mb-2 ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-600'}`}>
            Layout Custom
          </p>
          <p className={`text-sm font-mono ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Faça upload de um PDF customizado no formulário para ver o preview aqui
          </p>
        </div>
      </div>
    );
  }

  // Render visant layout if template is visant
  if (data.template === 'visant') {
    return <VisantPreviewContent data={data} editable={editable} onDataChange={onDataChange} saveStatus={saveStatus} budgetId={budgetId} isSidebarOpen={isSidebarOpen} />;
  }

  const calculateTotal = (deliverable: Deliverable): number => {
    return deliverable.quantity * deliverable.unitValue;
  };

  const calculateGrandTotal = (): number => {
    return data.deliverables.reduce((sum, d) => sum + calculateTotal(d), 0);
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const primaryColor = data.brandColors[0] || 'brand-cyan';
  const secondaryColor = data.brandColors[1] || '#34d399';

  return (
    <div className={`w-full h-full overflow-auto p-8 ${theme === 'dark' ? 'bg-[#0C0C0C] text-neutral-100' : 'bg-white text-neutral-900'}`}>
      <style>
        {`
          @media print {
            body { print-color-adjust: exact; }
          }
        `}
      </style>

      {/* Header with Logo and Brand */}
      <div className="mb-8 pb-6 border-b-2" style={{ borderColor: primaryColor }}>
        <div className="flex items-center justify-between mb-4">
          {data.brandLogo && (
            <img
              src={data.brandLogo}
              alt={data.brandName}
              className="h-16 object-contain"
            />
          )}
          <div className="text-right">
            <h1 className="text-3xl font-bold" style={{ color: primaryColor }}>
              {data.brandName}
            </h1>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="mb-8">
        <h2 className="text-4xl font-bold mb-2">{t('budget.title')}</h2>
        <p className="text-lg text-neutral-600">{data.projectName}</p>
      </div>

      {/* Client Info */}
      <div className="mb-8 grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-neutral-500 mb-1 uppercase">
            {t('budget.clientName')}
          </h3>
          <p className="text-base">{data.clientName}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-500 mb-1 uppercase flex items-center gap-2">
            <Calendar size={14} />
            {t('budget.startDate')} - {t('budget.endDate')}
          </h3>
          <p className="text-base">
            {formatDate(data.startDate)} - {formatDate(data.endDate)}
          </p>
        </div>
      </div>

      {/* Project Description */}
      {data.projectDescription && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2" style={{ color: primaryColor }}>
            {t('budget.projectDescription')}
          </h3>
          <p className="text-base text-neutral-700 whitespace-pre-wrap">
            {data.projectDescription}
          </p>
        </div>
      )}

      {/* Deliverables */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4" style={{ color: primaryColor }}>
          {t('budget.deliverables')}
        </h3>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2" style={{ borderColor: primaryColor }}>
              <th className="text-left py-3 px-4 font-semibold">{t('budget.deliverableName')}</th>
              <th className="text-center py-3 px-4 font-semibold">{t('budget.quantity')}</th>
              <th className="text-right py-3 px-4 font-semibold">{t('budget.unitValue')}</th>
              <th className="text-right py-3 px-4 font-semibold">{t('budget.total')}</th>
            </tr>
          </thead>
          <tbody>
            {data.deliverables.map((deliverable, index) => (
              <tr key={index} className="border-b border-neutral-200">
                <td className="py-3 px-4">
                  <div>
                    <div className="font-medium">{deliverable.name}</div>
                    {deliverable.description && (
                      <div className="text-sm text-neutral-600">{deliverable.description}</div>
                    )}
                  </div>
                </td>
                <td className="text-center py-3 px-4">{deliverable.quantity}</td>
                <td className="text-right py-3 px-4">{formatCurrency(deliverable.unitValue)}</td>
                <td className="text-right py-3 px-4 font-semibold">
                  {formatCurrency(calculateTotal(deliverable))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2" style={{ borderColor: primaryColor }}>
              <td colSpan={3} className="text-right py-4 px-4 font-bold text-lg">
                {t('budget.total')}:
              </td>
              <td className="text-right py-4 px-4 font-bold text-lg" style={{ color: primaryColor }}>
                {formatCurrency(calculateGrandTotal())}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Observations */}
      {data.observations && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2" style={{ color: primaryColor }}>
            {t('budget.observations')}
          </h3>
          <p className="text-base text-neutral-700 whitespace-pre-wrap">
            {data.observations}
          </p>
        </div>
      )}

      {/* FAQ */}
      {data.faq && data.faq.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4" style={{ color: primaryColor }}>
            {t('budget.faq')}
          </h3>
          <div className="space-y-4">
            {data.faq.map((item, index) => (
              <div key={index} className="border-l-4 pl-4" style={{ borderColor: secondaryColor }}>
                <h4 className="font-semibold mb-1">{item.question}</h4>
                <p className="text-neutral-700 text-sm">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      {(data.links.website || data.links.instagram || data.links.whatsapp) && (
        <div className="mb-8 pt-6 border-t border-neutral-200">
          <h3 className="text-lg font-semibold mb-4" style={{ color: primaryColor }}>
            {t('budget.links')}
          </h3>
          <div className="flex flex-wrap gap-4">
            {data.links.website && (
              <a
                href={data.links.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-neutral-700 hover:underline"
              >
                <Globe size={16} />
                {data.links.website}
              </a>
            )}
            {data.links.instagram && (
              <a
                href={`https://instagram.com/${data.links.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-neutral-700 hover:underline"
              >
                <Instagram size={16} />
                {data.links.instagram}
              </a>
            )}
            {data.links.whatsapp && (
              <a
                href={`https://wa.me/${data.links.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-neutral-700 hover:underline"
              >
                <MessageCircle size={16} />
                {data.links.whatsapp}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-neutral-200 text-center text-sm text-neutral-500">
        <p>Generated by Budget Machine® - {new Date().toLocaleDateString('pt-BR')}</p>
      </div>
    </div>
  );
};

