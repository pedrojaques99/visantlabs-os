/** The share sheet is how a phone saves to Photos. A computer keeps the plain download. */
const PHONE = '(pointer: coarse) and (max-width: 767px), (pointer: coarse) and (max-height: 500px)';

export function canShareFile(type: string, name: string): boolean {
  if (typeof navigator.canShare !== 'function' || !window.matchMedia(PHONE).matches) return false;
  return navigator.canShare({ files: [new File([], name, { type })] });
}

/**
 * `blocked` means the browser wants a fresh tap: Safari drops the permission from the first
 * tap while a large file renders. The file is ready by then, so one more tap is enough.
 */
export async function shareFile(
  file: File
): Promise<'shared' | 'cancelled' | 'blocked' | 'failed'> {
  try {
    await navigator.share({ files: [file] });
    return 'shared';
  } catch (error) {
    const name = (error as Error).name;
    if (name === 'AbortError') return 'cancelled';
    return name === 'NotAllowedError' ? 'blocked' : 'failed';
  }
}
