import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { BudgetData, PdfFieldMapping } from '../types/types';

// Helper to get field value from BudgetData or custom value
const getFieldValue = (data: BudgetData, mapping: PdfFieldMapping): string => {
  // If custom value exists, use it
  if (mapping.customValue !== undefined && mapping.customValue !== null) {
    return mapping.customValue;
  }

  const fieldId = mapping.fieldId;

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
      // Handle nested fields
      if (fieldId.startsWith('deliverable.')) {
        const index = parseInt(fieldId.split('.')[1]);
        const deliverable = data.deliverables[index];
        if (!deliverable) return '';
        const subField = fieldId.split('.')[2];
        if (subField === 'name') return deliverable.name;
        if (subField === 'description') return deliverable.description;
        if (subField === 'quantity') return deliverable.quantity.toString();
        if (subField === 'unitValue') return deliverable.unitValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        if (subField === 'total') {
          return (deliverable.quantity * deliverable.unitValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
      }
      // Custom fields (starting with custom_)
      if (fieldId.startsWith('custom_')) {
        return mapping.customValue || '';
      }
      return '';
  }
};

// Helper to convert hex color to RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? rgb(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
    )
    : rgb(0, 0, 0);
};

export const generateCustomBudgetPDF = async (
  data: BudgetData,
  pdfUrl: string,
  fieldMappings: PdfFieldMapping[]
): Promise<void> => {
  try {
    // Fetch the PDF
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch PDF');
    }

    const pdfBytes = await response.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Helper to get font based on fontFamily
    const getFont = async (fontFamily?: string, isBold?: boolean) => {
      // Uses standard PDF fonts for compatibility
      // [ENHANCEMENT] Custom fonts (geist, manrope, etc.) can be embedded if needed
      if (isBold) {
        return await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      }
      return await pdfDoc.embedFont(StandardFonts.Helvetica);
    };

    // Pre-load fonts
    const defaultFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const defaultBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Get all pages
    const pages = pdfDoc.getPages();

    // Fill in fields for each mapping
    for (const mapping of fieldMappings) {
      const pageIndex = (mapping.page || 1) - 1;
      if (pageIndex < 0 || pageIndex >= pages.length) {
        console.warn(`Page ${mapping.page} not found for field ${mapping.fieldId}`);
        continue;
      }

      const page = pages[pageIndex];
      const fieldValue = getFieldValue(data, mapping);

      if (!fieldValue) {
        continue;
      }

      // Get color
      const color = mapping.color ? hexToRgb(mapping.color) : rgb(0, 0, 0);

      // Get font (using bold property if specified)
      const isBold = mapping.bold || false;
      const font = await getFont(mapping.fontFamily, isBold);

      // Get alignment
      const fontSize = mapping.fontSize || 12;
      const textWidth = font.widthOfTextAtSize(fieldValue, fontSize);
      const pageWidth = page.getWidth();

      let x = mapping.x;
      if (mapping.align === 'center') {
        x = (pageWidth - textWidth) / 2;
      } else if (mapping.align === 'right') {
        x = pageWidth - textWidth - mapping.x;
      }

      // PDF coordinates: Y starts at bottom, so we need to flip
      const pageHeight = page.getHeight();
      const y = pageHeight - mapping.y;

      // Draw text
      page.drawText(fieldValue, {
        x,
        y,
        size: fontSize,
        font,
        color,
      });
    }

    // Save the PDF
    const modifiedPdfBytes = await pdfDoc.save();
    const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget-custom-${data.projectName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error('Error generating custom PDF:', error);
    throw new Error(`Failed to generate custom PDF: ${error.message}`);
  }
};

