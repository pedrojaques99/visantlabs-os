/**
 * Formats PIX code for display (adds spaces for readability)
 */
export const formatPixCode = (code: string): string => {
  if (!code) return '';
  
  // Remove any existing spaces
  const cleanCode = code.replace(/\s/g, '');
  
  // Add spaces every 4 characters for better readability
  return cleanCode.replace(/(.{4})/g, '$1 ').trim();
};

/**
 * Copies PIX code to clipboard
 */
export const copyPixToClipboard = async (code: string): Promise<boolean> => {
  try {
    // Remove spaces before copying
    const cleanCode = code.replace(/\s/g, '');
    await navigator.clipboard.writeText(cleanCode);
    return true;
  } catch (error) {
    console.error('Failed to copy PIX code:', error);
    return false;
  }
};

/**
 * Formats expiration time remaining
 */
export const formatExpirationTime = (expiresAt: string | null): string => {
  if (!expiresAt) return '';

  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) return 'Expirado';

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

/**
 * Generates QR Code data URL from PIX code (if needed)
 * Note: This is a fallback. Stripe should provide the QR code directly.
 */
export const generatePixQrCode = async (pixCode: string): Promise<string | null> => {
  try {
    // If we need to generate QR code client-side, we can use a library like qrcode
    // For now, we'll rely on Stripe providing the QR code
    return null;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    return null;
  }
};

