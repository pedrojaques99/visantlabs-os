import { jsPDF } from 'jspdf';
import type { BudgetData, Deliverable } from '../types';
import { generateCustomBudgetPDF } from './generateCustomBudgetPDF';

export const generateBudgetPDF = async (data: BudgetData, t: (key: string) => string) => {
  // If custom PDF is provided, use it instead
  if (data.customPdfUrl && data.pdfFieldMappings && data.pdfFieldMappings.length > 0) {
    try {
      await generateCustomBudgetPDF(data, data.customPdfUrl, data.pdfFieldMappings);
      return;
    } catch (error: any) {
      console.error('Error generating custom PDF, falling back to default:', error);
      // Fall through to default PDF generation
    }
  }
  if (data.template === 'visant') {
    return generateVisantPDF(data, t);
  }
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  const primaryColor = data.brandColors[0] ? hexToRgb(data.brandColors[0]) : [82, 221, 235] as [number, number, number];
  const secondaryColor = data.brandColors[1] ? hexToRgb(data.brandColors[1]) : [52, 211, 153] as [number, number, number];

  // Helper to convert hex to RGB
  function hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
      : [82, 221, 235] as [number, number, number];
  }

  // Helper function to add new page if needed
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper function to add text with word wrap
  const addText = (text: string, fontSize: number, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    if (isBold) {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }

    const lines = doc.splitTextToSize(text, maxWidth);
    checkNewPage(lines.length * (fontSize * 0.4) + 5);

    lines.forEach((line: string) => {
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.4;
    });

    yPosition += 5;
  };

  // Helper function to add heading
  const addHeading = (text: string, fontSize: number = 16) => {
    checkNewPage(20);
    yPosition += 10;
    addText(text, fontSize, true, primaryColor as [number, number, number]);
    yPosition += 5;
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Format date
  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Calculate totals
  const calculateTotal = (deliverable: Deliverable): number => {
    return deliverable.quantity * deliverable.unitValue;
  };

  const calculateGrandTotal = (): number => {
    return data.deliverables.reduce((sum, d) => sum + calculateTotal(d), 0);
  };

  // Header with Logo
  if (data.brandLogo) {
    try {
      // Try to add logo (base64 image)
      const img = new Image();
      img.src = data.brandLogo;

      // Wait for image to load (synchronous approach for jsPDF)
      const imgData = data.brandLogo;
      const imgWidth = 40;
      const imgHeight = 40;
      doc.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
    }
  }

  // Brand Name
  doc.setFontSize(20);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(data.brandName, pageWidth - margin, margin + 20, { align: 'right' });

  yPosition = Math.max(yPosition, margin + 30);

  // Title
  addHeading(t('budget.title'), 24);
  yPosition += 5;

  // Project Name
  addText(data.projectName, 16, true);
  yPosition += 10;

  // Client Info and Dates
  checkNewPage(30);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`${t('budget.clientName')}: ${data.clientName}`, margin, yPosition);
  yPosition += 6;
  doc.text(`${t('budget.startDate')} - ${t('budget.endDate')}: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}`, margin, yPosition);
  yPosition += 15;

  // Project Description
  if (data.projectDescription) {
    addHeading(t('budget.projectDescription'), 14);
    addText(data.projectDescription, 10);
    yPosition += 5;
  }

  // Deliverables Table
  if (data.deliverables.length > 0) {
    checkNewPage(40);
    addHeading(t('budget.deliverables'), 16);
    yPosition += 5;

    // Table header
    const tableTop = yPosition;
    const colWidths = [80, 25, 35, 35];
    const rowHeight = 8;

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

    doc.text(t('budget.deliverableName'), margin, yPosition);
    doc.text(t('budget.quantity'), margin + colWidths[0], yPosition);
    doc.text(t('budget.unitValue'), margin + colWidths[0] + colWidths[1], yPosition);
    doc.text(t('budget.total'), margin + colWidths[0] + colWidths[1] + colWidths[2], yPosition);

    yPosition += rowHeight;

    // Draw header line
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    // Table rows
    data.deliverables.forEach((deliverable) => {
      checkNewPage(rowHeight * 2);

      const nameLines = doc.splitTextToSize(deliverable.name, colWidths[0] - 5);
      const descLines = deliverable.description
        ? doc.splitTextToSize(deliverable.description, colWidths[0] - 5)
        : [];

      const maxLines = Math.max(nameLines.length, descLines.length, 1);

      doc.setFontSize(9);
      doc.text(nameLines[0] || '', margin, yPosition);
      if (descLines.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(descLines[0], margin, yPosition + 4);
        doc.setTextColor(0, 0, 0);
      }

      doc.setFontSize(9);
      doc.text(deliverable.quantity.toString(), margin + colWidths[0], yPosition, { align: 'center' });
      doc.text(formatCurrency(deliverable.unitValue), margin + colWidths[0] + colWidths[1], yPosition, { align: 'right' });
      doc.text(formatCurrency(calculateTotal(deliverable)), margin + colWidths[0] + colWidths[1] + colWidths[2], yPosition, { align: 'right' });

      yPosition += rowHeight * maxLines + 2;
    });

    // Total row
    checkNewPage(rowHeight * 2);
    yPosition += 5;
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(t('budget.total') + ':', margin + colWidths[0] + colWidths[1], yPosition, { align: 'right' });
    doc.text(formatCurrency(calculateGrandTotal()), margin + colWidths[0] + colWidths[1] + colWidths[2], yPosition, { align: 'right' });
    yPosition += 10;
  }

  // Observations
  if (data.observations) {
    checkNewPage(30);
    addHeading(t('budget.observations'), 14);
    addText(data.observations, 10);
    yPosition += 5;
  }

  // FAQ
  if (data.faq && data.faq.length > 0) {
    checkNewPage(40);
    addHeading(t('budget.faq'), 16);
    yPosition += 5;

    data.faq.forEach((item) => {
      checkNewPage(30);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Q: ' + item.question, margin + 5, yPosition);
      yPosition += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const answerLines = doc.splitTextToSize('A: ' + item.answer, maxWidth - 10);
      answerLines.forEach((line: string) => {
        doc.text(line, margin + 10, yPosition);
        yPosition += 5;
      });
      yPosition += 5;
    });
  }

  // Links
  if (data.links.website || data.links.instagram || data.links.whatsapp) {
    checkNewPage(30);
    yPosition += 5;
    addHeading(t('budget.links'), 14);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    if (data.links.website) {
      doc.text(`Website: ${data.links.website}`, margin, yPosition);
      yPosition += 6;
    }
    if (data.links.instagram) {
      doc.text(`Instagram: ${data.links.instagram}`, margin, yPosition);
      yPosition += 6;
    }
    if (data.links.whatsapp) {
      doc.text(`WhatsApp: ${data.links.whatsapp}`, margin, yPosition);
      yPosition += 6;
    }
  }

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${totalPages} - Budget Machine®`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Generate filename
  const filename = `budget-${data.projectName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;

  // Save PDF
  doc.save(filename);
};

// Generate Visant PDF
const generateVisantPDF = (data: BudgetData, t: (key: string) => string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth(); // A4 width in points (595.28)
  const pageHeight = doc.internal.pageSize.getHeight(); // A4 height in points (841.89)

  // Calculate content dimensions based on user settings
  // Convert pixels to points: 1px ≈ 0.75pt at 96dpi
  // User sets width/height in pixels (default 800px width), PDF uses points (A4 = 595.28pt width, 841.89pt height)
  const userContentWidth = data.contentWidth || 800; // pixels
  const userContentHeight = data.contentHeight; // pixels (optional)
  const pixelsToPoints = 0.75; // conversion ratio
  let contentWidthPoints = userContentWidth * pixelsToPoints;
  let contentHeightPoints = userContentHeight ? userContentHeight * pixelsToPoints : undefined;

  // Ensure content doesn't exceed page width (with some margin)
  const maxContentWidth = pageWidth - 40; // leave 20pt margin on each side
  if (contentWidthPoints > maxContentWidth) {
    contentWidthPoints = maxContentWidth;
  }

  // Ensure content doesn't exceed page height if height is set
  if (contentHeightPoints && contentHeightPoints > pageHeight - 40) {
    contentHeightPoints = pageHeight - 40;
  }

  const margin = (pageWidth - contentWidthPoints) / 2;
  const maxWidth = contentWidthPoints;
  let yPosition = margin;

  const accentColor = data.brandAccentColor || data.brandColors[0] || 'brand-cyan';
  const bgColor = data.brandBackgroundColor || '#ffffff';
  const accentRgb = hexToRgb(accentColor);
  const bgRgb = hexToRgb(bgColor);
  const isDarkBg = bgColor !== '#ffffff' && bgColor !== '#fff' && bgColor !== 'white';
  const textColor = (isDarkBg ? [255, 255, 255] : [0, 0, 0]) as [number, number, number];
  const secondaryTextColor = (isDarkBg ? [200, 200, 200] : [100, 100, 100]) as [number, number, number];

  function hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
      : [82, 221, 235] as [number, number, number];
  }

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const addText = (
    text: string,
    x: number,
    y: number,
    fontSize: number = 12,
    isBold: boolean = false,
    color: [number, number, number] = [0, 0, 0],
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.text(text, x, y, { align });
  };

  // Set background color
  doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Header with Orçamento
  addText('Orçamento', margin, yPosition + 10, 14, false, textColor, 'left');

  // Brand name banner (right side)
  const brandNameX = pageWidth - margin;
  addText(data.brandName, brandNameX, yPosition + 10, 14, false, textColor, 'right');

  // Draw banner border
  doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  doc.setLineWidth(1);
  const bannerWidth = doc.getTextWidth(data.brandName) + 16;
  const bannerX = pageWidth - margin - bannerWidth;
  doc.roundedRect(bannerX, yPosition, bannerWidth, 12, 2, 2, 'S');

  yPosition += 30;

  // Project Title
  addText(data.projectName || 'Projeto de Branding Completo - Logo, ID Visual e Extras', margin, yPosition, 18, true, textColor, 'left');
  yPosition += 15;

  // Services Section Header
  doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  const servicesHeaderHeight = 12;
  const servicesHeaderWidth = 100;
  doc.roundedRect(margin, yPosition, servicesHeaderWidth, servicesHeaderHeight, 2, 2, 'F');
  addText('Serviços', margin + 8, yPosition + 8, 14, true, [255, 255, 255], 'left');
  addText('Qtd.', margin + servicesHeaderWidth - 20, yPosition + 8, 10, false, [255, 255, 255], 'right');
  yPosition += servicesHeaderHeight + 10;

  // Services List
  data.deliverables.forEach((deliverable, index) => {
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      yPosition = margin;
    }

    addText(`${index + 1}.`, margin, yPosition, 12, false, secondaryTextColor, 'left');
    addText(deliverable.name, margin + 15, yPosition, 12, true, textColor, 'left');

    if (deliverable.description) {
      yPosition += 6;
      const descLines = doc.splitTextToSize(deliverable.description, maxWidth - 35);
      descLines.forEach((line: string) => {
        addText(line, margin + 15, yPosition, 10, false, secondaryTextColor, 'left');
        yPosition += 5;
      });
    }

    addText(`${deliverable.quantity}x`, pageWidth - margin, yPosition - (deliverable.description ? 5 : 0), 12, false, textColor, 'right');
    yPosition += 12;
  });

  // Total Hours
  const totalHours = data.paymentInfo?.totalHours || 0;
  if (totalHours > 0) {
    yPosition += 5;
    addText(`Total Horas de Trabalho: ${totalHours}h`, margin, yPosition, 10, false, secondaryTextColor, 'left');
    yPosition += 10;
  }

  // Observations
  if (data.observations) {
    yPosition += 5;
    addText(`*${data.observations}`, margin, yPosition, 9, false, secondaryTextColor, 'left');
    yPosition += 10;
  }

  // Footer Section
  yPosition = pageHeight - 100;

  // Signatures
  const signatures = data.signatures || [];
  if (signatures.length > 0) {
    signatures.forEach((sig, index) => {
      const sigX = margin + (index * (pageWidth / 3));
      addText(sig.name, sigX, yPosition, 10, false, secondaryTextColor, 'left');
      doc.setDrawColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
      doc.line(sigX, yPosition + 8, sigX + 80, yPosition + 8);
      addText(sig.role, sigX, yPosition + 12, 8, false, secondaryTextColor, 'left');
    });
  } else {
    addText('Pedro Xavier', margin, yPosition, 10, false, secondaryTextColor, 'left');
    doc.setDrawColor(secondaryTextColor[0], secondaryTextColor[1], secondaryTextColor[2]);
    doc.line(margin, yPosition + 8, margin + 80, yPosition + 8);
    addText('Designer / Diretor', margin, yPosition + 12, 8, false, secondaryTextColor, 'left');

    addText('Pedro Jaques', margin + 120, yPosition, 10, false, secondaryTextColor, 'left');
    doc.line(margin + 120, yPosition + 8, margin + 200, yPosition + 8);
    addText('Designer / Diretor', margin + 120, yPosition + 12, 8, false, secondaryTextColor, 'left');
  }

  // Investment (right side)
  if (totalHours > 0 && data.paymentInfo?.hourlyRate) {
    const hourlyRate = data.paymentInfo!.hourlyRate!;
    addText('Investimento:', pageWidth - margin, yPosition, 10, false, secondaryTextColor, 'right');
    addText(`${totalHours}h - R$${hourlyRate}/h`, pageWidth - margin, yPosition + 6, 10, false, textColor, 'right');
  }

  // Total Banner with Arrow
  yPosition = pageHeight - 50;
  const totalHoursCalc = data.paymentInfo?.totalHours || 0;
  const hourlyRateCalc = data.paymentInfo?.hourlyRate || 0;
  const totalFromHours = totalHoursCalc * hourlyRateCalc;
  const grandTotal = totalFromHours > 0 ? totalFromHours : data.deliverables.reduce((sum, d) => sum + (d.quantity * d.unitValue), 0);

  doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
  const totalBannerWidth = 120;
  const totalBannerX = pageWidth - margin - totalBannerWidth;
  doc.roundedRect(totalBannerX, yPosition, totalBannerWidth, 15, 2, 2, 'F');
  addText(`TOTAL: ${formatCurrency(grandTotal)}`, totalBannerX + 8, yPosition + 10, 14, true, [255, 255, 255], 'left');

  // Arrow
  doc.setFillColor(255, 255, 255);
  doc.triangle(
    totalBannerX + totalBannerWidth - 5, yPosition + 7.5,
    totalBannerX + totalBannerWidth + 5, yPosition + 7.5,
    totalBannerX + totalBannerWidth, yPosition + 2.5,
    'F'
  );
  doc.triangle(
    totalBannerX + totalBannerWidth - 5, yPosition + 7.5,
    totalBannerX + totalBannerWidth + 5, yPosition + 7.5,
    totalBannerX + totalBannerWidth, yPosition + 12.5,
    'F'
  );

  // Payment Terms
  yPosition = pageHeight - 30;
  const paymentTerms = data.paymentInfo?.paymentMethods?.[0]?.description || '50/50 no PIX, ou à vista com desconto';
  addText(paymentTerms, margin, yPosition, 9, false, secondaryTextColor, 'left');

  // PIX and Discount Footer
  yPosition = pageHeight - 15;
  const pixKey = data.paymentInfo?.pixKey || '29673608000169';
  addText(`PIX: ${pixKey}`, margin, yPosition, 9, true, textColor, 'left');

  const discountPercent = data.paymentInfo?.cashDiscountPercent || 0;
  if (discountPercent > 0) {
    const discountAmount = grandTotal * (discountPercent / 100);
    const finalWithDiscount = grandTotal - discountAmount;
    addText(`Desconto de ${discountPercent}% à vista no PIX! (${formatCurrency(finalWithDiscount)})`, pageWidth - margin, yPosition, 9, true, textColor, 'right');
  }

  // Generate filename
  const filename = `budget-visant-${data.projectName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;

  // Save PDF
  doc.save(filename);
};

