import { compressPdf as gsCompress } from '../services/ghostscriptService';

export async function compressPdf(pdfBase64: string): Promise<string> {
  try {
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const result = await gsCompress(Buffer.from(base64Data, 'base64'), 'ebook');
    return result.toString('base64');
  } catch (error: any) {
    console.error('PDF compression failed, returning original:', error.message);
    return pdfBase64.replace(/^data:application\/pdf;base64,/, '');
  }
}

export async function compressPdfSimple(pdfBase64: string): Promise<string> {
  return compressPdf(pdfBase64);
}
