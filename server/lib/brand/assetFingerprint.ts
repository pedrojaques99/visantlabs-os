/**
 * assetFingerprint — duplicate detection for brand assets (logos + media).
 *
 * Three signals:
 *  - `sha256` of the bytes → EXACT duplicate (same file re-uploaded). Authoritative.
 *  - `size` → cheap pre-hint.
 *  - `phash` (dHash, via sharp) → NEAR duplicate (same image re-exported / resized /
 *    recompressed). Compared by Hamming distance.
 *
 * Persisted on each asset so re-uploads / re-ingests are detected without
 * re-downloading, and so existing libraries can be de-duped after the fact.
 */
import crypto from 'crypto';

export interface AssetFingerprint {
  sha256: string;
  size: number;
  phash?: string; // 16 hex chars (64-bit dHash); absent for non-images
}

export function sha256Of(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** sha256 + byte size + perceptual dHash (best-effort — phash omitted on failure). */
export async function fingerprint(buf: Buffer): Promise<AssetFingerprint> {
  const fp: AssetFingerprint = { sha256: sha256Of(buf), size: buf.length };
  try {
    const { default: sharp } = await import('sharp');
    // dHash: grayscale 9×8, compare each pixel to its right neighbour → 64 bits.
    const { data } = await sharp(buf)
      .greyscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let bits = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        bits += data[row * 9 + col] < data[row * 9 + col + 1] ? '1' : '0';
      }
    }
    fp.phash = BigInt('0b' + bits)
      .toString(16)
      .padStart(16, '0');
  } catch {
    /* non-image / sharp failure — no perceptual hash */
  }
  return fp;
}

/** Hamming distance between two dHash hex strings (64 = "completely different"). */
export function hamming(a?: string, b?: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let x = BigInt('0x' + a) ^ BigInt('0x' + b);
  let d = 0;
  while (x > 0n) {
    d += Number(x & 1n);
    x >>= 1n;
  }
  return d;
}

// Two images within this dHash distance are treated as the same visual asset.
export const NEAR_DUP_THRESHOLD = 6;

export interface FingerprintedAsset {
  id: string;
  label?: string;
  hash?: string;
  phash?: string;
}

/**
 * Find an EXACT (sha256) or NEAR (phash ≤ threshold) duplicate among existing
 * assets. Exact wins over near. Returns null when the asset is new.
 */
export function findDuplicate(
  fp: AssetFingerprint,
  existing: FingerprintedAsset[]
): { kind: 'exact' | 'similar'; asset: { id: string; label?: string } } | null {
  for (const a of existing) {
    if (a.hash && a.hash === fp.sha256) {
      return { kind: 'exact', asset: { id: a.id, label: a.label } };
    }
  }
  if (fp.phash) {
    for (const a of existing) {
      if (a.phash && hamming(a.phash, fp.phash) <= NEAR_DUP_THRESHOLD) {
        return { kind: 'similar', asset: { id: a.id, label: a.label } };
      }
    }
  }
  return null;
}
