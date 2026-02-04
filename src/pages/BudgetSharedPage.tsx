import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { budgetApi, type BudgetProject } from '../services/budgetApi';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { FormButton } from '../components/ui/form-button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateBudgetPDF } from '@/utils/generateBudgetPDF';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { BudgetData } from '../types/types';
import { VisantCoverPage } from '../components/budget/visant/VisantCoverPage';
import { VisantTimelinePage } from '../components/budget/visant/VisantTimelinePage';
import { VisantIntroductionPage } from '../components/budget/visant/VisantIntroductionPage';
import { VisantBudgetPage } from '../components/budget/visant/VisantBudgetPage';
import { VisantGiftsPage } from '../components/budget/visant/VisantGiftsPage';
import { VisantPaymentPage } from '../components/budget/visant/VisantPaymentPage';
import { VisantBackCoverPage } from '../components/budget/visant/VisantBackCoverPage';
import { VisantPageRenderer } from '../components/budget/visant/VisantPageRenderer';
import { useVisantTemplate } from '@/hooks/useVisantTemplate';
import { ResponsivePageWrapper } from '../components/budget/visant/ResponsivePageWrapper';
import { SEO } from '../components/SEO';

export const BudgetSharedPage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [budget, setBudget] = useState<BudgetProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shareId) {
      loadSharedBudget(shareId);
    }
  }, [shareId]);

  const loadSharedBudget = async (shareId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await budgetApi.getShared(shareId);
      setBudget(data);
    } catch (error: any) {
      console.error('Error loading shared budget:', error);
      setError(error.message || t('budget.errors.failedToLoadBudget'));
      toast.error(t('budget.errors.failedToLoadShared'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!budget) return;

    try {
      const data: BudgetData = {
        template: budget.template,
        clientName: budget.clientName,
        projectName: budget.name || budget.projectDescription.split('\n')[0] || '',
        projectDescription: budget.projectDescription,
        startDate: budget.startDate,
        endDate: budget.endDate,
        deliverables: Array.isArray(budget.deliverables) ? budget.deliverables : [],
        observations: budget.observations || '',
        links: budget.links || {},
        faq: Array.isArray(budget.faq) ? budget.faq : [],
        brandColors: budget.brandColors || ['brand-cyan'],
        brandName: budget.brandName,
        brandLogo: budget.brandLogo || undefined,
        customPdfUrl: (budget as any).data?.customPdfUrl || (budget as any).customPdfUrl || undefined,
        pdfFieldMappings: (budget as any).data?.pdfFieldMappings || (budget as any).pdfFieldMappings || undefined,
        contentWidth: (budget as any).data?.contentWidth || undefined,
        contentHeight: (budget as any).data?.contentHeight || undefined,
        timeline: budget.timeline || undefined,
        paymentInfo: budget.paymentInfo || undefined,
        signatures: budget.signatures || undefined,
        giftOptions: budget.giftOptions || undefined,
        customContent: (budget as any).customContent || undefined,
        finalCTAText: (budget as any).finalCTAText || undefined,
        year: (budget as any).year || undefined,
        serviceTitle: (budget as any).data?.serviceTitle || (budget as any).serviceTitle || undefined,
        coverBackgroundColor: (budget as any).data?.coverBackgroundColor || (budget as any).coverBackgroundColor || undefined,
        coverTextColor: (budget as any).data?.coverTextColor || (budget as any).coverTextColor || undefined,
        brandAccentColor: budget.brandAccentColor || undefined,
        brandBackgroundColor: budget.brandBackgroundColor || undefined,
      };

      await generateBudgetPDF(data, t);
      toast.success(t('budget.shared.pdfGeneratedSuccess'));
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error(error.message || t('budget.errors.failedToGeneratePDF'));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-14 relative">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10">
          <div className="flex items-center justify-center min-h-[60vh]">
            <SkeletonLoader height="2rem" className="w-64" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !budget) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-14 relative">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h2 className="text-2xl font-bold text-neutral-200 mb-4">{t('budget.shared.budgetNotFound')}</h2>
            <p className="text-neutral-400 mb-6">{error || t('budget.shared.budgetNotFoundDescription')}</p>
            <FormButton onClick={() => navigate('/')}>{t('notFound.goHome')}</FormButton>
          </div>
        </div>
      </div>
    );
  }

  const budgetData: BudgetData = {
    template: budget.template,
    clientName: budget.clientName,
    projectName: budget.name || budget.projectDescription.split('\n')[0] || '',
    projectDescription: budget.projectDescription,
    startDate: budget.startDate,
    endDate: budget.endDate,
    deliverables: Array.isArray(budget.deliverables) ? budget.deliverables : [],
    observations: budget.observations || '',
    links: budget.links || {},
    faq: Array.isArray(budget.faq) ? budget.faq : [],
    brandColors: budget.brandColors || ['brand-cyan'],
    brandName: budget.brandName,
    brandLogo: budget.brandLogo || undefined,
    contentWidth: (budget as any).data?.contentWidth || undefined,
    contentHeight: (budget as any).data?.contentHeight || undefined,
    customPdfUrl: (budget as any).data?.customPdfUrl || (budget as any).customPdfUrl || undefined,
    pdfFieldMappings: (budget as any).data?.pdfFieldMappings || (budget as any).pdfFieldMappings || undefined,
    timeline: budget.timeline || undefined,
    paymentInfo: budget.paymentInfo || undefined,
    signatures: budget.signatures || undefined,
    giftOptions: budget.giftOptions || undefined,
    customContent: (budget as any).customContent || undefined,
    finalCTAText: (budget as any).finalCTAText || undefined,
    year: (budget as any).year || undefined,
    serviceTitle: (budget as any).data?.serviceTitle || (budget as any).serviceTitle || undefined,
    coverBackgroundColor: (budget as any).data?.coverBackgroundColor || (budget as any).coverBackgroundColor || undefined,
    coverTextColor: (budget as any).data?.coverTextColor || (budget as any).coverTextColor || undefined,
    brandAccentColor: budget.brandAccentColor || undefined,
    brandBackgroundColor: budget.brandBackgroundColor || undefined,
  };

  return (
    <>
      <SEO
        title={budget ? t('budget.shared.seoTitle', { name: budget.name }) : t('budget.shared.seoTitleDefault')}
        description={t('budget.shared.seoDescription')}
        noindex={true}
      />
      <BudgetSharedContent budgetData={budgetData} budgetName={budget.name || budget.projectDescription.split('\n')[0] || ''} onDownloadPDF={handleDownloadPDF} t={t} />
    </>
  );
};

// Component to render shared budget as landing page (no preview frame)
const BudgetSharedContent: React.FC<{
  budgetData: BudgetData;
  budgetName: string;
  onDownloadPDF: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}> = ({ budgetData, budgetName, onDownloadPDF, t }) => {
  const { activeTemplate, isLoading } = useVisantTemplate();
  const { theme } = useTheme();

  // Refs for each page component
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Function to generate PDF from rendered components
  const handleDownloadPDFFromComponents = async () => {
    if (budgetData.template !== 'visant') {
      onDownloadPDF();
      return;
    }

    try {
      toast.loading(t('budget.shared.generatingPDF'), { id: 'pdf-generation' });

      const pageWidth = budgetData.contentWidth || 800;
      const pageHeight = budgetData.contentHeight || 1131;

      // Convert px to mm (1px ≈ 0.264583mm at 96dpi)
      const pxToMm = 0.264583;
      const pageWidthMm = pageWidth * pxToMm;
      const pageHeightMm = pageHeight * pxToMm;

      const doc = new jsPDF({
        orientation: pageWidthMm > pageHeightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pageWidthMm, pageHeightMm],
      });

      // Define the order of pages to capture
      const pageOrder = ['cover', 'timeline', 'introduction', 'budget', 'gifts', 'payment', 'backCover'];

      // Get all page containers (they have data-page attribute)
      const allPageContainers = Array.from(document.querySelectorAll('[data-page]')) as HTMLElement[];

      if (allPageContainers.length === 0) {
        // Fallback: use the original PDF generation
        onDownloadPDF();
        return;
      }

      // Sort pages by the defined order
      const sortedPageContainers = pageOrder
        .map(pageName => allPageContainers.find(container => container.getAttribute('data-page') === pageName))
        .filter((container): container is HTMLElement => container !== undefined);

      console.log(`Found ${sortedPageContainers.length} pages to capture:`, sortedPageContainers.map(c => c.getAttribute('data-page')));

      // Capture each page in order
      for (let i = 0; i < sortedPageContainers.length; i++) {
        const wrapper = sortedPageContainers[i] as HTMLElement;
        const pageName = wrapper.getAttribute('data-page');

        console.log(`Capturing page ${i + 1}/${sortedPageContainers.length}: ${pageName}`);

        // Scroll into view to ensure it's fully rendered
        wrapper.scrollIntoView({ behavior: 'instant', block: 'start' });
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Get actual dimensions from the wrapper (in pixels for html2canvas)
        const rect = wrapper.getBoundingClientRect();
        const actualWidth = pageWidth; // Use configured width in px
        const actualHeight = pageHeight; // Use configured height in px

        // Find the inner content div that contains the actual page
        const innerContent = wrapper.querySelector('div[style*="maxWidth"]') || wrapper.firstElementChild || wrapper;

        console.log(`Page ${pageName} dimensions: ${actualWidth}x${actualHeight}`);

        // Capture as canvas with error handling for unsupported CSS colors
        try {
          // Temporarily suppress console warnings about unsupported CSS colors
          const originalWarn = console.warn;
          const suppressedWarnings: string[] = [];
          console.warn = (...args: any[]) => {
            const message = args.join(' ');
            // Suppress oklch color parsing warnings
            if (message.includes('oklch') || message.includes('unsupported color function')) {
              suppressedWarnings.push(message);
              return;
            }
            originalWarn.apply(console, args);
          };

          const canvas = await html2canvas(innerContent as HTMLElement, {
            width: actualWidth,
            height: actualHeight,
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: null, // Transparent background to preserve page backgrounds
            windowWidth: actualWidth,
            windowHeight: actualHeight,
            x: 0,
            y: 0,
            onclone: (clonedDoc) => {
              // Suppress oklch color parsing errors by overriding CSS variables
              // Create a style element that overrides problematic CSS variables
              const overrideStyle = clonedDoc.createElement('style');
              overrideStyle.textContent = `
                :root, .dark {
                  --background: #ffffff !important;
                  --foreground: #1a1a1a !important;
                  --card: #ffffff !important;
                  --card-foreground: #1a1a1a !important;
                  --popover: #ffffff !important;
                  --popover-foreground: #1a1a1a !important;
                  --primary: #1a1a1a !important;
                  --primary-foreground: #ffffff !important;
                  --secondary: #f5f5f5 !important;
                  --secondary-foreground: #1a1a1a !important;
                  --muted: #f5f5f5 !important;
                  --muted-foreground: #6b7280 !important;
                  --accent: #f5f5f5 !important;
                  --accent-foreground: #1a1a1a !important;
                  --destructive: #dc2626 !important;
                  --border: #e5e7eb !important;
                  --input: #e5e7eb !important;
                  --ring: #6b7280 !important;
                }
              `;
              clonedDoc.head.insertBefore(overrideStyle, clonedDoc.head.firstChild);
            },
          }).finally(() => {
            // Restore original console.warn
            console.warn = originalWarn;
          });

          // Convert to image
          const imgData = canvas.toDataURL('image/png', 1.0);

          console.log(`Canvas captured for ${pageName}: ${canvas.width}x${canvas.height}`);

          // Add new page if not the first one
          if (i > 0) {
            doc.addPage();
            console.log(`Added new page ${i + 1} to PDF document`);
          }

          // Get current page number (jsPDF is 1-indexed)
          const currentPageNum = doc.getNumberOfPages();
          console.log(`Current page number: ${currentPageNum}, adding ${pageName}`);

          // Ensure we're on the correct page
          doc.setPage(currentPageNum);

          // Set white background for each page
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, pageWidthMm, pageHeightMm, 'F');

          // Calculate scaling - always fit to page dimensions exactly
          const imgWidth = pageWidthMm;
          const imgHeight = pageHeightMm;

          console.log(`Adding image to page ${currentPageNum} at size ${imgWidth}mm x ${imgHeight}mm`);

          // Add image to PDF, filling the entire page
          doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');

          // Verify page count
          const totalPages = doc.getNumberOfPages();
          console.log(`✓ Page ${i + 1}/${sortedPageContainers.length} (${pageName}) added to PDF. Total pages: ${totalPages}`);
        } catch (captureError: any) {
          console.error(`Error capturing page ${i + 1} (${pageName}):`, captureError);
          // Continue to next page instead of failing completely
          continue;
        }
      }

      // Final verification
      const finalPageCount = doc.getNumberOfPages();
      console.log(`\n📄 PDF Generation Complete!`);
      console.log(`Total pages in document: ${finalPageCount}`);
      console.log(`Expected pages: ${sortedPageContainers.length}`);

      if (finalPageCount !== sortedPageContainers.length) {
        console.warn(`⚠️ WARNING: Page count mismatch! Expected ${sortedPageContainers.length}, got ${finalPageCount}`);
      }

      // Save PDF
      const filename = `budget-${budgetName?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'budget'}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      toast.success(t('budget.shared.pdfGeneratedSuccess'), { id: 'pdf-generation' });
    } catch (error: any) {
      console.error('Error generating PDF from components:', error);
      toast.error(error.message || t('budget.errors.failedToGeneratePDF'), { id: 'pdf-generation' });

      // Fallback to original method
      onDownloadPDF();
    }
  };

  const handleShare = async () => {
    const currentUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(currentUrl);
      toast.success(t('budget.shared.linkCopied'));
    } catch (error) {
      console.error('Error copying link:', error);
      toast.error(t('budget.errors.failedToCopyLink'));
    }
  };


  // If custom PDF, show it in iframe
  if (budgetData.customPdfUrl) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0C0C0C]' : 'bg-white'}`}>
        <div className={`sticky top-0 z-50 ${theme === 'dark' ? 'bg-[#0C0C0C] border-neutral-800' : 'bg-white border-neutral-200'} border-b shadow-sm`}>
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="mb-3">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/">{t('apps.home')}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/budget-machine">{t('budget.title')}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{t('budget.shared.title')}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center justify-between">
              <h1 className={`text-xl font-bold font-mono truncate flex-1 mr-4 ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}>
                {budgetName}
              </h1>
              <div className="flex items-center gap-2">
                <FormButton onClick={handleShare} className="flex items-center gap-2">
                  <Share2 size={16} />
                  {t('budget.share')}
                </FormButton>
                <FormButton onClick={handleDownloadPDFFromComponents} className="flex items-center gap-2">
                  <Download size={16} />
                  {t('budget.downloadPDF')}
                </FormButton>
              </div>
            </div>
          </div>
        </div>
        <iframe
          src={budgetData.customPdfUrl}
          className="w-full h-screen border-0"
          title={t('budget.shared.title')}
        />
      </div>
    );
  }

  // If template is visant
  if (budgetData.template === 'visant') {
    // Use custom template if available
    if (!isLoading && activeTemplate) {
      return (
        <div className="min-h-screen bg-white">
          <div className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="mb-3">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/">{t('apps.home')}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/budget-machine">{t('budget.title')}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{t('budget.shared.title')}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-neutral-900 font-mono truncate flex-1 mr-4">
                  {budgetName}
                </h1>
                <div className="flex items-center gap-2">
                  <FormButton onClick={handleShare} className="flex items-center gap-2">
                    <Share2 size={16} />
                    {t('budget.share')}
                  </FormButton>
                  <FormButton onClick={onDownloadPDF} className="flex items-center gap-2">
                    <Download size={16} />
                    {t('budget.downloadPDF')}
                  </FormButton>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full">
            <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="cover" budgetData={budgetData}>
              <VisantPageRenderer
                data={budgetData}
                layout={activeTemplate.layout}
                pageName="cover"
                editable={false}
              />
            </ResponsivePageWrapper>
            <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="timeline" budgetData={budgetData}>
              <VisantTimelinePage data={budgetData} editable={false} />
            </ResponsivePageWrapper>
            <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="introduction" budgetData={budgetData}>
              <VisantPageRenderer
                data={budgetData}
                layout={activeTemplate.layout}
                pageName="introduction"
                editable={false}
              />
            </ResponsivePageWrapper>
            <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="budget" budgetData={budgetData}>
              <VisantPageRenderer
                data={budgetData}
                layout={activeTemplate.layout}
                pageName="budget"
                editable={false}
              />
            </ResponsivePageWrapper>
            <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="gifts" budgetData={budgetData}>
              <VisantPageRenderer
                data={budgetData}
                layout={activeTemplate.layout}
                pageName="gifts"
                editable={false}
              />
            </ResponsivePageWrapper>
            <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="payment" budgetData={budgetData}>
              <VisantPageRenderer
                data={budgetData}
                layout={activeTemplate.layout}
                pageName="payment"
                editable={false}
              />
            </ResponsivePageWrapper>
            <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="backCover" budgetData={budgetData}>
              <VisantPageRenderer
                data={budgetData}
                layout={activeTemplate.layout}
                pageName="backCover"
                editable={false}
              />
            </ResponsivePageWrapper>
          </div>
        </div>
      );
    }

    // Default Visant pages
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0C0C0C]' : 'bg-white'}`}>
        <div className={`sticky top-0 z-50 ${theme === 'dark' ? 'bg-[#0C0C0C] border-neutral-800' : 'bg-white border-neutral-200'} border-b shadow-sm`}>
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="mb-3">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/">{t('apps.home')}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/budget-machine">{t('budget.title')}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{t('budget.shared.title')}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center justify-between">
              <h1 className={`text-xl font-bold font-mono truncate flex-1 mr-4 ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}>
                {budgetName}
              </h1>
              <div className="flex items-center gap-2">
                <FormButton onClick={handleShare} className="flex items-center gap-2">
                  <Share2 size={16} />
                  {t('budget.share')}
                </FormButton>
                <FormButton onClick={handleDownloadPDFFromComponents} className="flex items-center gap-2">
                  <Download size={16} />
                  {t('budget.downloadPDF')}
                </FormButton>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full">
          <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="cover" budgetData={budgetData}>
            <VisantCoverPage data={budgetData} editable={false} />
          </ResponsivePageWrapper>
          <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="timeline" budgetData={budgetData}>
            <VisantTimelinePage data={budgetData} editable={false} />
          </ResponsivePageWrapper>
          <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="introduction" budgetData={budgetData}>
            <VisantIntroductionPage data={budgetData} editable={false} />
          </ResponsivePageWrapper>
          <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="budget" budgetData={budgetData}>
            <VisantBudgetPage data={budgetData} editable={false} />
          </ResponsivePageWrapper>
          <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="gifts" budgetData={budgetData}>
            <VisantGiftsPage data={budgetData} editable={false} />
          </ResponsivePageWrapper>
          <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="payment" budgetData={budgetData}>
            <VisantPaymentPage data={budgetData} editable={false} />
          </ResponsivePageWrapper>
          <ResponsivePageWrapper contentWidth={budgetData.contentWidth} pageName="backCover" budgetData={budgetData}>
            <VisantBackCoverPage data={budgetData} editable={false} />
          </ResponsivePageWrapper>
        </div>
      </div>
    );
  }

  // Fallback for other templates
  return (
    <>
      <SEO
        title={t('budget.shared.seoTitle', { name: budgetName })}
        description={t('budget.shared.seoDescription')}
        noindex={true}
      />
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0C0C0C]' : 'bg-white'}`}>
        <div className={`sticky top-0 z-50 ${theme === 'dark' ? 'bg-[#0C0C0C] border-neutral-800' : 'bg-white border-neutral-200'} border-b shadow-sm`}>
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="mb-3">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/">{t('apps.home')}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/budget-machine">{t('budget.title')}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{t('budget.shared.title')}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center justify-between">
              <h1 className={`text-xl font-bold font-mono truncate flex-1 mr-4 ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-900'}`}>
                {budgetName}
              </h1>
              <div className="flex items-center gap-2">
                <FormButton onClick={handleShare} className="flex items-center gap-2">
                  <Share2 size={16} />
                  {t('budget.share')}
                </FormButton>
                <FormButton onClick={onDownloadPDF} className="flex items-center gap-2">
                  <Download size={16} />
                  {t('budget.downloadPDF')}
                </FormButton>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <p className={`text-center ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>{t('budget.shared.templateNotSupported')}</p>
        </div>
      </div>
    </>
  );
};

