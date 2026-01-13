import { jsPDF } from 'jspdf';
import type { BrandingData } from '../types/types';
import { getStepContent } from './brandingHelpers';

interface TextSegment {
  text: string;
  isBold: boolean;
  isItalic: boolean;
}

/**
 * Remove color tags from markdown text
 * Format: [color:#hex]text[/color]
 */
const stripColorTags = (text: string): string => {
  return text.replace(/\[color:[^\]]+\]/g, '').replace(/\[\/color\]/g, '');
};

/**
 * Parse markdown text into segments with formatting information
 * Handles **bold**, *italic*, and nested formatting
 */
const parseMarkdownSegments = (text: string): TextSegment[] => {
  if (!text) return [];

  const segments: TextSegment[] = [];
  let i = 0;
  let currentText = '';

  while (i < text.length) {
    // Check for bold: **text** (takes priority over italic)
    if (text.substring(i, i + 2) === '**') {
      // Save any accumulated plain text
      if (currentText) {
        segments.push({ text: currentText, isBold: false, isItalic: false });
        currentText = '';
      }

      const closingBold = text.indexOf('**', i + 2);
      if (closingBold !== -1) {
        const boldContent = text.substring(i + 2, closingBold);
        // Recursively parse bold content for italic inside
        const boldSegments = parseMarkdownSegments(boldContent);
        boldSegments.forEach(seg => {
          segments.push({ text: seg.text, isBold: true, isItalic: seg.isItalic });
        });
        i = closingBold + 2;
        continue;
      }
    }

    // Check for italic: *text* (but not ** which is bold)
    if (text[i] === '*' && text[i + 1] !== '*') {
      // Save any accumulated plain text
      if (currentText) {
        segments.push({ text: currentText, isBold: false, isItalic: false });
        currentText = '';
      }

      const closingItalic = text.indexOf('*', i + 1);
      if (closingItalic !== -1) {
        const italicContent = text.substring(i + 1, closingItalic);
        segments.push({ text: italicContent, isBold: false, isItalic: true });
        i = closingItalic + 1;
        continue;
      }
    }

    // Regular character
    currentText += text[i];
    i++;
  }

  // Add remaining plain text
  if (currentText) {
    segments.push({ text: currentText, isBold: false, isItalic: false });
  }

  return segments;
};

/**
 * Clean text content - normalize newlines and remove color tags
 */
const cleanTextContent = (text: string): string => {
  if (!text) return '';

  // Remove color tags
  let cleaned = stripColorTags(text);

  // Convert literal \n to actual newlines
  cleaned = cleaned.replace(/\\n/g, '\n');

  // Convert markdown-style bullet points (*   ) to proper bullets
  cleaned = cleaned.replace(/^\s*[\*\-]\s+/gm, '• ');

  // Normalize multiple consecutive newlines to double newlines (paragraph breaks)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
};

/**
 * Check if a line is a bullet point
 */
const isBulletLine = (line: string): boolean => {
  const trimmed = line.trim();
  return /^[-*•]\s/.test(trimmed);
};

/**
 * Extract bullet content (remove bullet marker)
 */
const extractBulletContent = (line: string): string => {
  return line.replace(/^[-*•]\s+/, '').trim();
};

/**
 * Add formatted text with markdown support to PDF
 * Processes markdown formatting (bold, italic) and bullets
 */
const addFormattedText = (
  doc: jsPDF,
  text: string,
  fontSize: number,
  maxWidth: number,
  margin: number,
  yPosition: number
): number => {
  const cleaned = cleanTextContent(text);
  const lines = cleaned.split('\n');
  let currentY = yPosition;
  const lineHeight = fontSize * 0.4;
  const bulletIndent = 8;

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    // Empty line - add spacing
    if (!trimmedLine) {
      currentY += lineHeight;
      return;
    }

    // Bullet point
    if (isBulletLine(trimmedLine)) {
      const bulletContent = extractBulletContent(trimmedLine);
      const segments = parseMarkdownSegments(bulletContent);

      // Add bullet marker
      doc.setFontSize(fontSize);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(82, 221, 235);
      doc.text('•', margin, currentY);

      // Process segments with formatting
      let xPos = margin + bulletIndent;
      let lineStartX = xPos;

      segments.forEach((segment) => {
        doc.setFontSize(fontSize);
        doc.setTextColor(0, 0, 0);

        // Set font style
        if (segment.isBold && segment.isItalic) {
          doc.setFont(undefined, 'bolditalic');
        } else if (segment.isBold) {
          doc.setFont(undefined, 'bold');
        } else if (segment.isItalic) {
          doc.setFont(undefined, 'italic');
        } else {
          doc.setFont(undefined, 'normal');
        }

        // Calculate available width
        const availableWidth = maxWidth - (xPos - margin);

        // Split segment text to fit width
        const segmentLines = doc.splitTextToSize(segment.text, availableWidth);

        segmentLines.forEach((segLine: string, idx: number) => {
          if (idx === 0) {
            // First line of segment
            doc.text(segLine, xPos, currentY);
            xPos += doc.getTextWidth(segLine);
          } else {
            // Wrapped line - reset to bullet indent
            currentY += lineHeight;
            xPos = lineStartX;
            doc.text(segLine, xPos, currentY);
            xPos += doc.getTextWidth(segLine);
          }
        });
      });

      currentY += lineHeight;
      return;
    }

    // Regular text with markdown - process segments
    const segments = parseMarkdownSegments(trimmedLine);
    let xPos = margin;

    segments.forEach((segment) => {
      doc.setFontSize(fontSize);
      doc.setTextColor(0, 0, 0);

      // Set font style
      if (segment.isBold && segment.isItalic) {
        doc.setFont(undefined, 'bolditalic');
      } else if (segment.isBold) {
        doc.setFont(undefined, 'bold');
      } else if (segment.isItalic) {
        doc.setFont(undefined, 'italic');
      } else {
        doc.setFont(undefined, 'normal');
      }

      // Calculate available width
      const availableWidth = maxWidth - (xPos - margin);

      // Split segment text to fit width
      const segmentLines = doc.splitTextToSize(segment.text, availableWidth);

      segmentLines.forEach((segLine: string, idx: number) => {
        if (idx === 0) {
          // First line of segment
          doc.text(segLine, xPos, currentY);
          xPos += doc.getTextWidth(segLine);
        } else {
          // Wrapped line - reset to margin
          currentY += lineHeight;
          xPos = margin;
          doc.text(segLine, xPos, currentY);
          xPos += doc.getTextWidth(segLine);
        }
      });
    });

    currentY += lineHeight;
  });

  return currentY;
};

export const generateBrandingPDF = (
  data: BrandingData,
  prompt: string,
  t: (key: string) => string,
  steps?: Array<{ id: number; title: string }>
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Helper function to add new page if needed
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper function to add simple text with word wrap
  const addText = (text: string, fontSize: number, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    if (isBold) {
      doc.setFont(undefined, 'bold');
    } else {
      doc.setFont(undefined, 'normal');
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
    addText(text, fontSize, true, [82, 221, 235]);
    yPosition += 5;
  };

  // Helper function to add formatted text content (with markdown support)
  const addFormattedContent = (content: string, fontSize: number = 10) => {
    const requiredSpace = content.split('\n').length * (fontSize * 0.4) + 10;
    checkNewPage(requiredSpace);

    yPosition = addFormattedText(doc, content, fontSize, maxWidth, margin, yPosition);
    yPosition += 5;
  };

  // Title Page
  doc.setTextColor(82, 221, 235);
  doc.setFontSize(24);
  doc.setFont(undefined, 'bold');
  doc.text('BRANDING MACHINE', pageWidth / 2, 50, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.text('Relatório Completo de Branding', pageWidth / 2, 65, { align: 'center' });

  yPosition = 90;
  addText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 10);

  if (data.name) {
    yPosition += 5;
    addText(`Projeto: ${data.name}`, 10, true);
  }

  yPosition += 10;

  // Brand Description
  addHeading('DESCRIÇÃO DA MARCA', 16);
  addFormattedContent(prompt || data.prompt, 11);
  yPosition += 10;

  // Default steps if not provided
  const defaultSteps: Array<{ id: number; title: string }> = [
    { id: 1, title: t('branding.steps.mercadoNicho') },
    { id: 2, title: t('branding.steps.publicoAlvo') },
    { id: 3, title: t('branding.steps.posicionamento') },
    { id: 4, title: t('branding.steps.insights') },
    { id: 5, title: t('branding.steps.competitors') },
    { id: 6, title: t('branding.steps.references') },
    { id: 7, title: t('branding.steps.swotAnalysis') },
    { id: 8, title: t('branding.steps.colorPalettes') },
    { id: 9, title: t('branding.steps.visualElements') },
    { id: 10, title: t('branding.steps.persona') },
    { id: 11, title: t('branding.steps.mockupIdeas') },
    { id: 12, title: t('branding.steps.moodboard') },
    { id: 13, title: t('branding.steps.archetypes') },
  ];

  const stepsToUse = steps || defaultSteps;

  // Process each step dynamically
  stepsToUse.forEach((step) => {
    const content = getStepContent(step.id, data);

    // Skip if no content
    if (!content) return;

    // Check if content has data
    const hasData =
      (typeof content === 'string' && content.trim().length > 0) ||
      (Array.isArray(content) && content.length > 0) ||
      (typeof content === 'object' && content !== null && Object.keys(content).length > 0);

    if (!hasData) return;

    checkNewPage(30);
    addHeading(step.title, 14);
    yPosition += 5;

    // Step 1: Mercado e Nicho (string with markdown)
    if (step.id === 1) {
      if (typeof content === 'string') {
        addFormattedContent(content, 10);
      }
    }
    // Step 2: Público Alvo (string with markdown)
    else if (step.id === 2) {
      if (typeof content === 'string') {
        addFormattedContent(content, 10);
      }
    }
    // Step 3: Posicionamento (string with markdown)
    else if (step.id === 3) {
      if (typeof content === 'string') {
        addFormattedContent(content, 10);
      }
    }
    // Step 4: Insights (string with markdown)
    else if (step.id === 4) {
      if (typeof content === 'string') {
        addFormattedContent(content, 10);
      }
    }
    // Step 5: Competitors (array)
    else if (step.id === 5 && Array.isArray(content)) {
      content.forEach((item: any) => {
        if (typeof item === 'string') {
          addText(`• ${item}`, 10);
        } else if (item && typeof item === 'object' && item.name) {
          const competitorText = item.url ? `${item.name} (${item.url})` : item.name;
          addText(`• ${competitorText}`, 10);
        }
      });
    }
    // Step 6: References (array)
    else if (step.id === 6 && Array.isArray(content)) {
      content.forEach((item: any) => {
        addText(`• ${item}`, 10);
      });
    }
    // Step 7: SWOT Analysis (object)
    else if (step.id === 7 && typeof content === 'object' && content !== null) {
      const swot = content as {
        strengths?: string[];
        weaknesses?: string[];
        opportunities?: string[];
        threats?: string[];
      };

      if (swot.strengths && swot.strengths.length > 0) {
        addText(t('branding.strengths') || 'Forças', 12, true, [34, 197, 94]);
        swot.strengths.forEach((item: string) => {
          addText(`• ${item}`, 10);
        });
        yPosition += 5;
      }

      if (swot.weaknesses && swot.weaknesses.length > 0) {
        addText(t('branding.weaknesses') || 'Fraquezas', 12, true, [239, 68, 68]);
        swot.weaknesses.forEach((item: string) => {
          addText(`• ${item}`, 10);
        });
        yPosition += 5;
      }

      if (swot.opportunities && swot.opportunities.length > 0) {
        addText(t('branding.opportunities') || 'Oportunidades', 12, true, [59, 130, 246]);
        swot.opportunities.forEach((item: string) => {
          addText(`• ${item}`, 10);
        });
        yPosition += 5;
      }

      if (swot.threats && swot.threats.length > 0) {
        addText(t('branding.threats') || 'Ameaças', 12, true, [249, 115, 22]);
        swot.threats.forEach((item: string) => {
          addText(`• ${item}`, 10);
        });
        yPosition += 5;
      }
    }
    // Step 8: Color Palettes (array)
    else if (step.id === 8 && Array.isArray(content)) {
      content.forEach((palette: any, index: number) => {
        checkNewPage(40);
        addText(palette.name || `Paleta ${index + 1}`, 12, true);

        // Add color boxes (as text representation)
        const colorsText = Array.isArray(palette.colors)
          ? palette.colors.join(', ')
          : String(palette.colors || '');
        addText(`Cores: ${colorsText}`, 10);

        if (palette.psychology) {
          addFormattedContent(palette.psychology, 9);
        }

        yPosition += 10;
      });
    }
    // Step 9: Visual Elements (array)
    else if (step.id === 9 && Array.isArray(content)) {
      content.forEach((item: any) => {
        addText(`• ${item}`, 10);
      });
    }
    // Step 10: Persona (object)
    else if (step.id === 10 && typeof content === 'object' && content !== null) {
      const persona = content as {
        demographics?: string;
        desires?: string[];
        pains?: string[];
      };

      if (persona.demographics) {
        addText(t('branding.demographics') || 'Demografia', 12, true);
        addFormattedContent(persona.demographics, 10);
        yPosition += 5;
      }

      if (persona.desires && persona.desires.length > 0) {
        addText(t('branding.desires') || 'Desejos', 12, true);
        persona.desires.forEach((item: string) => {
          addText(`• ${item}`, 10);
        });
        yPosition += 5;
      }

      if (persona.pains && persona.pains.length > 0) {
        addText(t('branding.painPoints') || 'Pontos de Dor', 12, true);
        persona.pains.forEach((item: string) => {
          addText(`• ${item}`, 10);
        });
        yPosition += 5;
      }
    }
    // Step 11: Mockup Ideas (array)
    else if (step.id === 11 && Array.isArray(content)) {
      content.forEach((item: any) => {
        addText(`• ${item}`, 10);
      });
    }
    // Step 12: Moodboard (object)
    else if (step.id === 12 && typeof content === 'object' && content !== null) {
      const moodboard = content as {
        summary?: string;
        visualDirection?: string;
        keyElements?: string[];
      };

      if (moodboard.summary) {
        addText(t('branding.summary') || 'Resumo', 12, true);
        addFormattedContent(moodboard.summary, 10);
        yPosition += 5;
      }

      if (moodboard.visualDirection) {
        addText(t('branding.visualDirection') || 'Direção Visual', 12, true);
        addFormattedContent(moodboard.visualDirection, 10);
        yPosition += 5;
      }

      if (moodboard.keyElements && moodboard.keyElements.length > 0) {
        addText(t('branding.keyElements') || 'Elementos Chave', 12, true);
        moodboard.keyElements.forEach((item: string) => {
          addText(`• ${item}`, 10);
        });
      }
    }
    // Step 13: Archetypes (object) - NEW
    else if (step.id === 13 && typeof content === 'object' && content !== null) {
      const archetypes = content as {
        primary?: {
          id: number;
          title: string;
          description: string;
          examples?: string[];
        };
        secondary?: {
          id: number;
          title: string;
          description: string;
          examples?: string[];
        };
        reasoning?: string;
      };

      if (archetypes.primary) {
        addText('Arquétipo Primário', 12, true);
        addText(archetypes.primary.title, 11, true);
        if (archetypes.primary.description) {
          addFormattedContent(archetypes.primary.description, 10);
        }
        if (archetypes.primary.examples && archetypes.primary.examples.length > 0) {
          addText('Exemplos:', 10, true);
          archetypes.primary.examples.forEach((example: string) => {
            addText(`• ${example}`, 9);
          });
        }
        yPosition += 5;
      }

      if (archetypes.secondary) {
        addText('Arquétipo Secundário', 12, true);
        addText(archetypes.secondary.title, 11, true);
        if (archetypes.secondary.description) {
          addFormattedContent(archetypes.secondary.description, 10);
        }
        if (archetypes.secondary.examples && archetypes.secondary.examples.length > 0) {
          addText('Exemplos:', 10, true);
          archetypes.secondary.examples.forEach((example: string) => {
            addText(`• ${example}`, 9);
          });
        }
        yPosition += 5;
      }

      if (archetypes.reasoning) {
        addText('Justificativa', 12, true);
        addFormattedContent(archetypes.reasoning, 10);
      }
    }
    // Fallback for other string content
    else if (typeof content === 'string') {
      addFormattedContent(content, 10);
    }
    // Fallback for other array content
    else if (Array.isArray(content)) {
      content.forEach((item: any) => {
        const itemText = typeof item === 'string' ? item : JSON.stringify(item);
        addText(`• ${itemText}`, 10);
      });
    }

    yPosition += 10;
  });

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${totalPages} - Branding Machine®`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Generate filename
  const projectName = data.name ? data.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() : 'branding';
  const filename = `${projectName}-report-${new Date().toISOString().split('T')[0]}.pdf`;

  // Save PDF
  doc.save(filename);
};
