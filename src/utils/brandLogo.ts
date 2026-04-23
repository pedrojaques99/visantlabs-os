/**
 * Resolve the best logo URL + display fallbacks for a brand guideline.
 * Centralizes the pattern that was duplicated across IdentitySection,
 * generateCreative, and BrandGuidelineSelector.
 */

type BrandLike = {
    id?: string;
    identity?: { name?: string; logoUrl?: string } | null;
    logos?: Array<{ url: string; variant?: string; label?: string } | null | undefined> | null;
};

export type LogoPreference = 'avatar' | 'primary';

/**
 * Pick the best logo URL for the given use case.
 * - `avatar` (default): small UI affordances — prefers 'icon' then 'primary' then first
 * - `primary`: hero/main display — prefers 'primary' then 'icon' then first
 * Falls back to `identity.logoUrl` if no logos array entries match.
 */
export function getBrandLogoUrl(
    brand: BrandLike | null | undefined,
    preference: LogoPreference = 'avatar'
): string | undefined {
    if (!brand) return undefined;
    const logos = (brand.logos || []).filter(Boolean) as Array<{ url: string; variant?: string }>;

    const find = (v: string) => logos.find(l => l.variant === v)?.url;

    if (preference === 'primary') {
        return find('primary') || find('icon') || logos[0]?.url || brand.identity?.logoUrl || undefined;
    }
    return find('icon') || find('primary') || logos[0]?.url || brand.identity?.logoUrl || undefined;
}

/** First letter of brand name (for avatar fallback). */
export function getBrandInitial(brand: BrandLike | null | undefined): string {
    const name = brand?.identity?.name || brand?.id || '?';
    return name.charAt(0).toUpperCase();
}

/** Safe display name. */
export function getBrandName(brand: BrandLike | null | undefined, fallback = 'Marca'): string {
    return brand?.identity?.name || brand?.id || fallback;
}
