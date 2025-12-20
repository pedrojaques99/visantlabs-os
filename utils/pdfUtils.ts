/**
 * PDF utilities for file conversion and validation
 */

const MAX_PDF_SIZE_MB = 50; // Gemini supports up to 50MB
export const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

// Maximum PDF size for upload to server (accounts for base64 encoding + JSON overhead)
// Base64 increases size by ~33%, and JSON adds overhead, so 3MB original ≈ 4MB+ in request
const MAX_PDF_UPLOAD_SIZE_MB = 3;
export const MAX_PDF_UPLOAD_SIZE_BYTES = MAX_PDF_UPLOAD_SIZE_MB * 1024 * 1024;

/**
 * Convert PDF file to base64 string
 * @param file - PDF File object
 * @returns Promise resolving to base64 string (without data URL prefix)
 */
export const pdfToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      if (!result) {
        reject(new Error('Failed to read PDF file'));
        return;
      }
      // Remove data URL prefix (data:application/pdf;base64,)
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      if (!base64 || base64.length === 0) {
        reject(new Error('Base64 data is empty'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = (error) => {
      reject(new Error(`Failed to read PDF file: ${error}`));
    };
  });
};

/**
 * Validate PDF file type
 * @param file - File to validate
 * @returns true if file is a PDF
 */
export const isValidPdfFile = (file: File): boolean => {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
};

/**
 * Validate PDF file size
 * @param file - File to validate
 * @returns true if file size is within limits
 */
export const isValidPdfSize = (file: File): boolean => {
  return file.size <= MAX_PDF_SIZE_BYTES;
};

/**
 * Get human-readable file size
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "5.2 MB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Validate PDF file (type and size)
 * @param file - File to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export const validatePdfFile = (file: File): { isValid: boolean; error?: string } => {
  if (!isValidPdfFile(file)) {
    return {
      isValid: false,
      error: 'Please select a PDF file',
    };
  }

  if (!isValidPdfSize(file)) {
    const fileSize = formatFileSize(file.size);
    const maxSize = formatFileSize(MAX_PDF_SIZE_BYTES);
    return {
      isValid: false,
      error: `PDF file size (${fileSize}) exceeds the maximum allowed size of ${maxSize}`,
    };
  }

  return { isValid: true };
};

/**
 * Estimate the original file size from a base64 string
 * Base64 encoding increases size by ~33%, so we divide by 1.33
 * @param base64 - Base64 encoded string
 * @returns Estimated original file size in bytes
 */
export const estimateBase64FileSize = (base64: string): number => {
  // Base64 uses 4 characters to represent 3 bytes
  // So original size ≈ (base64.length * 3) / 4
  // We use 0.75 as a safe approximation (3/4 = 0.75)
  return Math.floor(base64.length * 0.75);
};

/**
 * Validate PDF base64 size for upload
 * Checks if the base64-encoded PDF is small enough to upload
 * @param base64 - Base64 encoded PDF string
 * @returns Object with isValid boolean and error message if invalid
 */
export const validatePdfBase64Size = (base64: string): { isValid: boolean; error?: string } => {
  const estimatedSize = estimateBase64FileSize(base64);
  
  if (estimatedSize > MAX_PDF_UPLOAD_SIZE_BYTES) {
    const fileSize = formatFileSize(estimatedSize);
    const maxSize = formatFileSize(MAX_PDF_UPLOAD_SIZE_BYTES);
    return {
      isValid: false,
      error: `PDF is too large (${fileSize}). Maximum size for upload is ${maxSize}. Please compress the PDF or use a smaller file.`,
    };
  }
  
  return { isValid: true };
};
