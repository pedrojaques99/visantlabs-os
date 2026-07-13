/**
 * Scene licensing — the SSoT that decides which mockup scenes are safe to expose
 * commercially (the "isComercial" filter the catalog needs).
 *
 * The library is predominantly first-party work (made via Boxy/Visant) which is
 * commercially free. The exception is PSDs sourced from PAID mockup studios
 * (Mockup Hazard, Maison, …) which must NEVER reach the public/commercial pool.
 *
 * So the model is: default = 'commercial-free', with an explicit blocklist of
 * paid-studio name fragments → 'studio-paid'. This is filename-driven because
 * paid-studio PSDs almost always carry the studio name; it's extendable via env
 * (SCENE_PAID_STUDIOS) and overridable per-scene at prepare time. Filter-by-
 * license (not by folder) is what makes it leak-proof: a paid PSD dropped into a
 * public folder still resolves to 'studio-paid' and stays hidden.
 */

export type SceneLicense = 'commercial-free' | 'studio-paid' | 'internal';

export interface SceneLicenseInfo {
  license: SceneLicense;
  /** The paid studio, when license is 'studio-paid' (for provenance/audit). */
  studio?: string;
  /** Where the PSD came from, when known. */
  source?: 'boxy' | 'visant' | 'drive-import';
}

// Boundaries are LETTER-based (not \b), because filenames use "_" and "-" as word
// separators and "_" counts as a \w char — so /\bmaison\b/ would MISS "maison_frame".
// (?<![a-z])X(?![a-z]) treats _/-/digits/string-ends as boundaries but still avoids
// matching X inside a longer word like "compAraisON".
const L = (body: string) => new RegExp(`(?<![a-z])(?:${body})(?![a-z])`, 'i');

/** Paid studios whose PSDs must be excluded from the commercial pool. */
const BUILTIN_PAID_STUDIOS: Array<{ pattern: RegExp; studio: string }> = [
  { pattern: L('mockup[\\s_-]*hazard'), studio: 'Mockup Hazard' },
  { pattern: L('maison'), studio: 'Maison' },
  { pattern: L('pixeden'), studio: 'Pixeden' },
  { pattern: L('mr[\\s_.-]*mockup'), studio: 'Mr.Mockup' },
  { pattern: L('mockup[\\s_-]*world'), studio: 'Mockup World' },
  { pattern: L('mockup[\\s_-]*club'), studio: 'Mockup Club' },
];

/** Extra paid-studio name fragments from env (comma-separated), matched as literals. */
function envPaidStudios(): Array<{ pattern: RegExp; studio: string }> {
  return (process.env.SCENE_PAID_STUDIOS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({
      // Escape regex metachars; match the literal name, case-insensitive.
      pattern: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      studio: name,
    }));
}

export interface SceneLicenseOverride {
  license?: SceneLicense;
  studio?: string;
  source?: SceneLicenseInfo['source'];
}

/**
 * Resolve the license for a scene. An explicit override (from an admin at prepare
 * time) always wins. Otherwise the filename is matched against the paid-studio
 * blocklist; anything unmatched defaults to commercial-free.
 */
export function resolveSceneLicense(
  psdFileName: string,
  override?: SceneLicenseOverride
): SceneLicenseInfo {
  if (override?.license) {
    return {
      license: override.license,
      studio: override.studio,
      source: override.source,
    };
  }
  const name = String(psdFileName || '');
  for (const { pattern, studio } of [...BUILTIN_PAID_STUDIOS, ...envPaidStudios()]) {
    if (pattern.test(name)) {
      return { license: 'studio-paid', studio, source: override?.source };
    }
  }
  return { license: 'commercial-free', source: override?.source };
}

/**
 * The license to trust for a stored scene record. Falls back to resolving from the
 * filename when a record predates the license field (no backfill migration needed —
 * old paid-studio scenes still get classified and stay filtered).
 */
export function effectiveLicense(record: {
  psdFileName: string;
  license?: SceneLicense;
  studio?: string;
}): SceneLicenseInfo {
  if (record.license) return { license: record.license, studio: record.studio };
  return resolveSceneLicense(record.psdFileName);
}

/** True when a scene may appear in the public/commercial catalog. */
export function isCommercial(record: { psdFileName: string; license?: SceneLicense }): boolean {
  return effectiveLicense(record).license === 'commercial-free';
}
