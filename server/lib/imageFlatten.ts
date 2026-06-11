/**
 * Flatten the alpha channel to a white background for image-generation providers
 * (gpt-image, gemini, seedream) that reject or degrade RGBA reference images.
 *
 * Done at serve-time (when an image is sent to a provider), never on upload, so
 * the original transparent asset stays intact in storage / dashboard display.
 * Only PNG/WebP can carry alpha; everything else is returned untouched. sharp is
 * dynamically imported (same pattern as letterCropService) to keep it off the
 * hot import path.
 */
export async function flattenAlphaIfNeeded(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!mimeType.includes('png') && !mimeType.includes('webp')) return { buffer, mimeType };
  const { default: sharp } = await import('sharp');
  const meta = await sharp(buffer).metadata();
  if (!meta.hasAlpha) return { buffer, mimeType };
  const flattened = await sharp(buffer)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();
  return { buffer: flattened, mimeType: 'image/png' };
}
