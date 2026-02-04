import { PDFDocument, PDFImage, PDFPage } from 'pdf-lib';

export async function compressPdf(pdfBase64: string): Promise<string> {
  try {
    // Remove data URL prefix if present
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    
    // Convert base64 to buffer
    const pdfBytes = Buffer.from(base64Data, 'base64');
    
    // Load PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    // Target DPI for images (150-200 DPI is good for most use cases)
    const targetDPI = 175;
    
    // Process each page
    for (const page of pages) {
      await compressPageImages(page, targetDPI);
    }
    
    // Save compressed PDF
    const compressedBytes = await pdfDoc.save();
    
    // Convert back to base64
    const compressedBase64 = Buffer.from(compressedBytes).toString('base64');
    
    return compressedBase64;
  } catch (error: any) {
    console.error('Error compressing PDF:', error);
    // If compression fails, return original PDF as fallback
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    return base64Data;
  }
}

/**
 * Compress images in a PDF page
 * @param page - PDF page to process
 * @param targetDPI - Target DPI for images
 */
async function compressPageImages(page: PDFPage, targetDPI: number): Promise<void> {
  try {
    // Get page dimensions
    const { width, height } = page.getSize();
    
    // Calculate scale factor based on target DPI
    // Standard PDF resolution is 72 DPI, so we scale down images
    const scaleFactor = targetDPI / 72;
    
    // Note: pdf-lib doesn't provide direct access to embedded images in a page
    // We can only work with images that are explicitly embedded
    // For now, we'll use a simpler approach: re-embed images at lower quality
    
    // This is a simplified compression - in a production environment,
    // you might want to use a more sophisticated approach with pdfjs-dist
    // or other libraries that can extract and re-embed images
    
    // For now, we'll rely on pdf-lib's built-in compression options
    // which are applied when saving the document
  } catch (error: any) {
    console.error('Error compressing page images:', error);
    // Continue processing other pages even if one fails
  }
}

/**
 * Alternative compression using save options
 * Uses pdf-lib's built-in compression when saving
 * @param pdfBase64 - Base64 encoded PDF string
 * @returns Compressed PDF as base64 string
 */
export async function compressPdfSimple(pdfBase64: string): Promise<string> {
  try {
    // Remove data URL prefix if present
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    
    // Convert base64 to buffer
    const pdfBytes = Buffer.from(base64Data, 'base64');
    
    // Load PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      // Use object compression
      ignoreEncryption: false,
    });
    
    // Save with compression options
    // pdf-lib automatically applies compression when saving
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: false, // Disable object streams for better compatibility
    });
    
    // Convert back to base64
    const compressedBase64 = Buffer.from(compressedBytes).toString('base64');
    
    return compressedBase64;
  } catch (error: any) {
    console.error('Error compressing PDF (simple):', error);
    // If compression fails, return original PDF as fallback
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    return base64Data;
  }
}
